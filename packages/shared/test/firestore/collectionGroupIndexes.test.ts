import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

// A collection-group query (`collectionGroup(...).where(...)`) is NOT served by
// Firestore's automatic single-field indexes — those are COLLECTION-scoped only.
// A bare equality across a collection GROUP needs an explicit COLLECTION_GROUP
// single-field index (`fieldOverrides`), and a query that also orders needs a
// COLLECTION_GROUP composite index. The emulator that backs our function/rule
// tests never enforces indexes, so a query missing its production index passes
// CI green and only throws `FAILED_PRECONDITION` in beta/prod at runtime.
//
// This invariant closes that gap statically: every collection-group query in
// the codebase must have a matching COLLECTION_GROUP index declared in
// firestore.indexes.json. See fix for the beta `deleteAccount` 500 caused by a
// missing `registrations.userId` collection-group index.

const repoRoot = resolve(__dirname, '../../../..');
const indexesPath = resolve(repoRoot, 'firestore.indexes.json');

// Source trees that issue collection-group queries (client SDK in services,
// admin SDK in functions). Screens/hooks never touch Firestore directly.
const SOURCE_DIRS = ['packages/shared/src/services', 'functions/src'];

interface IndexField {
  fieldPath: string;
  order?: string;
  arrayConfig?: string;
}
interface CompositeIndex {
  collectionGroup: string;
  queryScope: string;
  fields: IndexField[];
}
interface FieldOverride {
  collectionGroup: string;
  fieldPath: string;
  indexes: { queryScope: string; order?: string; arrayConfig?: string }[];
}
interface IndexesFile {
  indexes: CompositeIndex[];
  fieldOverrides: FieldOverride[];
}

interface CollectionGroupQuery {
  file: string;
  line: number;
  group: string;
  whereFields: string[];
  orderByFields: string[];
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

// Match both `db.collectionGroup('members')` (admin) and
// `collectionGroup(getDb(), 'members')` (client): the group name is the last
// quoted argument.
const COLLECTION_GROUP = /collectionGroup\(\s*(?:[^,()]*,\s*)?['"]([\w-]+)['"]\s*\)/g;
const WHERE = /where\(\s*['"]([\w.]+)['"]/g;
const ORDER_BY = /orderBy\(\s*['"]([\w.]+)['"]/g;

function fieldsIn(text: string, re: RegExp): string[] {
  const fields: string[] = [];
  for (const m of text.matchAll(re)) fields.push(m[1]);
  return fields;
}

/**
 * Extract each collection-group query as (group, whereFields, orderByFields).
 * The query "window" runs from the `collectionGroup(...)` call to the terminal
 * `.get(` / `getDocs(`, which bounds the associated `where`/`orderBy` clauses
 * for both the admin chain and the client `query(cg, where..., orderBy...)`
 * form.
 */
function extractQueries(file: string): CollectionGroupQuery[] {
  const content = readFileSync(file, 'utf-8');
  const queries: CollectionGroupQuery[] = [];
  for (const match of content.matchAll(COLLECTION_GROUP)) {
    const start = match.index;
    const rest = content.slice(start);
    const getMatch = /\.get\(|getDocs\(/.exec(rest);
    const windowText = getMatch ? rest.slice(0, getMatch.index + getMatch[0].length) : rest;
    queries.push({
      file: relative(repoRoot, file),
      line: content.slice(0, start).split('\n').length,
      group: match[1],
      whereFields: fieldsIn(windowText, WHERE),
      orderByFields: fieldsIn(windowText, ORDER_BY),
    });
  }
  return queries;
}

function hasSingleFieldCG(file: IndexesFile, group: string, field: string): boolean {
  return file.fieldOverrides.some(
    (fo) =>
      fo.collectionGroup === group &&
      fo.fieldPath === field &&
      fo.indexes.some((i) => i.queryScope === 'COLLECTION_GROUP'),
  );
}

function hasCompositeCG(file: IndexesFile, group: string, orderedFields: string[]): boolean {
  return file.indexes.some(
    (idx) =>
      idx.collectionGroup === group &&
      idx.queryScope === 'COLLECTION_GROUP' &&
      orderedFields.every((f, i) => idx.fields[i]?.fieldPath === f),
  );
}

function suggestedOverride(group: string, field: string): string {
  return JSON.stringify(
    {
      collectionGroup: group,
      fieldPath: field,
      indexes: [{ queryScope: 'COLLECTION_GROUP', order: 'ASCENDING' }],
    },
    null,
    2,
  );
}

// The mirror-image footgun: declaring a `fieldOverride` for a field REPLACES
// Firestore's automatic single-field indexing for it *entirely* — including the
// COLLECTION-scoped index that a plain `where(field, '==', …)` on a specific
// (sub)collection relies on. So a field that is queried both group-scoped
// (needing a COLLECTION_GROUP override) and collection-scoped must list BOTH
// scopes in its override, or the collection-scoped read throws FAILED_PRECONDITION
// in beta/prod (the emulator ignores indexes, so tests stay green).
//
// This bit `registrations.userId`: adding the COLLECTION_GROUP override for
// `getUserRegistrationsAcrossEvents`/`deleteAccount` silently killed the
// automatic COLLECTION index that `getUserRegistrations` (events/{id}/
// registrations where userId == uid) depends on — so the event sign-up sheet
// loaded no dependents on the live web build.
//
// Fields with an override that are ALSO queried collection-scoped. Keep in sync
// with the services (grep `where('userId'` outside collectionGroup(...)).
const COLLECTION_SCOPED_OVERRIDDEN_FIELDS: { group: string; field: string }[] = [
  // getUserRegistrations — packages/shared/src/services/registrationService.ts
  { group: 'registrations', field: 'userId' },
];

describe('collection-scoped query survives its field override', () => {
  it('every overridden field queried at collection scope keeps a COLLECTION index', () => {
    const indexesFile = JSON.parse(readFileSync(indexesPath, 'utf-8')) as IndexesFile;

    const uncovered: string[] = [];
    for (const { group, field } of COLLECTION_SCOPED_OVERRIDDEN_FIELDS) {
      const override = indexesFile.fieldOverrides.find(
        (fo) => fo.collectionGroup === group && fo.fieldPath === field,
      );
      // No override at all → automatic COLLECTION indexing is intact; fine.
      if (!override) continue;
      if (override.indexes.some((i) => i.queryScope === 'COLLECTION')) continue;
      uncovered.push(
        `${group}.${field}: has a fieldOverride but no COLLECTION-scope index, ` +
          `so the collection-scoped where('${field}') query throws FAILED_PRECONDITION. ` +
          `Add { "queryScope": "COLLECTION", "order": "ASCENDING" } to its "indexes".`,
      );
    }

    expect(uncovered, ['Collection-scoped queries broken by a field override:', '', ...uncovered].join('\n')).toEqual(
      [],
    );
  });
});

describe('collection-group query index coverage invariant', () => {
  it('every collectionGroup(...).where(...) has a matching COLLECTION_GROUP index', () => {
    const indexesFile = JSON.parse(readFileSync(indexesPath, 'utf-8')) as IndexesFile;

    const queries = SOURCE_DIRS.flatMap((dir) =>
      listSourceFiles(resolve(repoRoot, dir)).flatMap(extractQueries),
    );

    const uncovered: string[] = [];
    for (const q of queries) {
      if (q.whereFields.length === 0) continue; // unfiltered scan needs no index

      for (const whereField of q.whereFields) {
        // A single-field COLLECTION_GROUP override serves any equality/range on
        // that field regardless of ordering, so it covers the query outright.
        if (hasSingleFieldCG(indexesFile, q.group, whereField)) continue;

        // Otherwise, an ordered query needs a composite whose leading fields are
        // the filter field(s) followed by the orderBy field(s).
        const ordered = [...q.whereFields, ...q.orderByFields];
        if (q.orderByFields.length > 0 && hasCompositeCG(indexesFile, q.group, ordered)) continue;

        uncovered.push(
          `${q.file}:${String(q.line)} — collectionGroup('${q.group}').where('${whereField}') ` +
            `has no COLLECTION_GROUP index. Add to firestore.indexes.json "fieldOverrides":\n` +
            suggestedOverride(q.group, whereField),
        );
      }
    }

    expect(
      uncovered,
      [
        'Collection-group queries need an explicit COLLECTION_GROUP index —',
        "Firestore's automatic single-field indexes are COLLECTION-scoped only,",
        'so these queries pass the emulator tests but throw FAILED_PRECONDITION',
        'in beta/prod. Declare the missing index(es) in firestore.indexes.json',
        'and deploy them:',
        '',
        ...uncovered,
      ].join('\n'),
    ).toEqual([]);
  });
});
