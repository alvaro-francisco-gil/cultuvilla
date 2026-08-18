#!/usr/bin/env node
/**
 * fetch-municipalities.mjs
 *
 * Queries Wikidata for every Spanish municipality (Q2074737 and its subclasses)
 * with an INE code (P772) and writes the result to
 * scripts/data/municipalities-es.json.
 *
 * Province + comunidadAutonoma are derived from the first two digits of the
 * INE code (the standard Spanish province code), against a hardcoded table —
 * which is stable: Spain hasn't changed its 52 province codes since 1833.
 *
 * USAGE
 *   node scripts/fetch-municipalities.mjs            # full run, writes JSON
 *   node scripts/fetch-municipalities.mjs --dry-run  # just print stats
 */

import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, 'data', 'municipalities-es.json');
const USER_AGENT = 'cultuvilla-municipality-fetcher/0.1 (https://github.com/alvaro-francisco-gil/cultuvilla)';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// ── INE province code (first 2 digits) → { province, comunidadAutonoma } ─────
// Source: INE "Códigos de provincia" (stable since 1833).

const PROVINCES = {
  '01': ['Álava',                 'País Vasco'],
  '02': ['Albacete',              'Castilla-La Mancha'],
  '03': ['Alicante',              'Comunidad Valenciana'],
  '04': ['Almería',               'Andalucía'],
  '05': ['Ávila',                 'Castilla y León'],
  '06': ['Badajoz',               'Extremadura'],
  '07': ['Islas Baleares',        'Islas Baleares'],
  '08': ['Barcelona',             'Cataluña'],
  '09': ['Burgos',                'Castilla y León'],
  '10': ['Cáceres',               'Extremadura'],
  '11': ['Cádiz',                 'Andalucía'],
  '12': ['Castellón',             'Comunidad Valenciana'],
  '13': ['Ciudad Real',           'Castilla-La Mancha'],
  '14': ['Córdoba',               'Andalucía'],
  '15': ['A Coruña',              'Galicia'],
  '16': ['Cuenca',                'Castilla-La Mancha'],
  '17': ['Girona',                'Cataluña'],
  '18': ['Granada',               'Andalucía'],
  '19': ['Guadalajara',           'Castilla-La Mancha'],
  '20': ['Guipúzcoa',             'País Vasco'],
  '21': ['Huelva',                'Andalucía'],
  '22': ['Huesca',                'Aragón'],
  '23': ['Jaén',                  'Andalucía'],
  '24': ['León',                  'Castilla y León'],
  '25': ['Lleida',                'Cataluña'],
  '26': ['La Rioja',              'La Rioja'],
  '27': ['Lugo',                  'Galicia'],
  '28': ['Madrid',                'Comunidad de Madrid'],
  '29': ['Málaga',                'Andalucía'],
  '30': ['Murcia',                'Región de Murcia'],
  '31': ['Navarra',               'Comunidad Foral de Navarra'],
  '32': ['Ourense',               'Galicia'],
  '33': ['Asturias',              'Principado de Asturias'],
  '34': ['Palencia',              'Castilla y León'],
  '35': ['Las Palmas',            'Canarias'],
  '36': ['Pontevedra',            'Galicia'],
  '37': ['Salamanca',             'Castilla y León'],
  '38': ['Santa Cruz de Tenerife','Canarias'],
  '39': ['Cantabria',             'Cantabria'],
  '40': ['Segovia',               'Castilla y León'],
  '41': ['Sevilla',               'Andalucía'],
  '42': ['Soria',                 'Castilla y León'],
  '43': ['Tarragona',             'Cataluña'],
  '44': ['Teruel',                'Aragón'],
  '45': ['Toledo',                'Castilla-La Mancha'],
  '46': ['Valencia',              'Comunidad Valenciana'],
  '47': ['Valladolid',            'Castilla y León'],
  '48': ['Vizcaya',               'País Vasco'],
  '49': ['Zamora',                'Castilla y León'],
  '50': ['Zaragoza',              'Aragón'],
  '51': ['Ceuta',                 'Ceuta'],
  '52': ['Melilla',               'Melilla'],
};

// ── SPARQL ────────────────────────────────────────────────────────────────────

// Two things here are load-bearing:
//
// 1. P279* — most municipalities are typed with a regional subclass ("municipio
//    de La Rioja", "concello", "concejo"), NOT with Q2074737 directly. Matching
//    P31 alone silently dropped ~2,000 of them, entire provinces at a time
//    (La Rioja: 7 of 174; A Coruña: 1 of 93).
// 2. Q16532593 (ciudad autónoma de España) — Ceuta is typed ONLY as an
//    autonomous city, never as a municipality, so the municipality branch alone
//    misses it. Melilla is only present because it happens to carry both.
const SPARQL = `
SELECT ?muni ?muniLabel ?ine WHERE {
  VALUES ?rootClass { wd:Q2074737 wd:Q16532593 }
  ?muni wdt:P31/wdt:P279* ?rootClass .
  ?muni wdt:P772 ?ine .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
`.trim();

const sleep = ms => new Promise(r => setTimeout(r, ms));

// WDQS truncates the response body under load, which surfaces as a JSON parse
// error on a 200 rather than an HTTP failure — so retry on parse errors too.
async function fetchSparql(attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch('https://query.wikidata.org/sparql', {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ query: SPARQL }),
      });
      if (!res.ok) throw new Error(`SPARQL ${res.status} ${res.statusText}`);
      const json = JSON.parse(await res.text());
      return json.results.bindings.map(b => ({
        qid: b.muni.value.split('/').pop(),
        name: b.muniLabel?.value ?? '',
        ine: b.ine.value,
      }));
    } catch (err) {
      if (attempt === attempts) throw err;
      const backoff = attempt * 5000;
      console.log(`  attempt ${attempt}/${attempts} failed (${err.message}); retrying in ${backoff / 1000}s...`);
      await sleep(backoff);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Querying Wikidata for all Spanish municipalities with INE codes...');
  const raw = await fetchSparql();
  console.log(`  Wikidata returned ${raw.length} rows.`);

  // Dedupe by INE (some munis appear twice with alt labels)
  const byIne = new Map();
  for (const r of raw) {
    // Validate INE: must be a 5-digit string (some Wikidata entries are dirty)
    if (!/^\d{5}$/.test(r.ine)) continue;
    // Filter out entries where Wikidata label fell back to the Q-id (means no es/en label)
    if (/^Q\d+$/.test(r.name)) continue;
    if (!byIne.has(r.ine)) byIne.set(r.ine, r);
  }
  console.log(`  After dedupe + validation: ${byIne.size} unique INE codes.`);

  // Map to final shape with province/CCAA from INE prefix
  const entries = [];
  const unknownProvince = [];
  for (const r of byIne.values()) {
    const prefix = r.ine.slice(0, 2);
    const prov = PROVINCES[prefix];
    if (!prov) {
      unknownProvince.push(r);
      continue;
    }
    entries.push({
      name: r.name,
      province: prov[0],
      comunidadAutonoma: prov[1],
      codigoINE: r.ine,
    });
  }
  entries.sort((a, b) =>
    a.codigoINE.localeCompare(b.codigoINE),
  );

  console.log(`  Mapped: ${entries.length}`);
  if (unknownProvince.length) {
    console.log(`  WARN: ${unknownProvince.length} entries with unknown province prefix (skipped):`);
    for (const r of unknownProvince.slice(0, 5)) console.log(`    ${r.ine}  ${r.name}`);
  }

  // Sanity: Spain has 8,131 municipios as of 2024. Wikidata also carries some
  // dissolved/merged municipalities, so a small surplus is expected; a shortfall
  // is not — it means the query is dropping real municipalities, which is how
  // the P279* regression went unnoticed. Bail instead of writing a partial file.
  const EXPECTED = 8131;
  const TOLERANCE = 100;
  const gap = EXPECTED - entries.length;
  console.log(`  Expected ~${EXPECTED}, got ${entries.length} (gap: ${gap}).`);

  if (entries.length < EXPECTED - TOLERANCE) {
    console.error(
      `\nFAIL: only ${entries.length} municipalities — ${gap} short of the expected ${EXPECTED}.\n` +
        `  Refusing to write a partial dataset. The query is dropping municipalities;\n` +
        `  check the P31/P279* class traversal before re-running.`,
    );
    process.exit(1);
  }
  if (entries.length > EXPECTED + TOLERANCE) {
    console.log(
      `  WARN: ${entries.length - EXPECTED} more than expected — likely dissolved/merged municipalities.`,
    );
  }

  // Per-province coverage, so a regionally-lopsided regression is visible at a
  // glance. Ceuta and Melilla are genuinely one municipality each — every other
  // province having a handful means the query lost a whole class of them.
  const SINGLE_MUNICIPALITY_PROVINCES = new Set(['Ceuta', 'Melilla']);
  const byProvince = new Map();
  for (const e of entries) byProvince.set(e.province, (byProvince.get(e.province) ?? 0) + 1);
  const thin = [...byProvince.entries()].filter(
    ([prov, n]) => n < 10 && !SINGLE_MUNICIPALITY_PROVINCES.has(prov),
  );
  if (thin.length) {
    console.log(`  WARN: ${thin.length} province(s) with fewer than 10 municipalities:`);
    for (const [prov, n] of thin) console.log(`    ${prov}: ${n}`);
  }

  // A province with ZERO entries never lands in byProvince, so the thin check
  // above cannot see it — this is how Ceuta stayed missing unnoticed.
  const empty = Object.values(PROVINCES)
    .map(([prov]) => prov)
    .filter(prov => !byProvince.has(prov));
  if (empty.length) {
    console.error(`\nFAIL: ${empty.length} province(s) with no municipalities at all:`);
    for (const prov of empty) console.error(`    ${prov}`);
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: not writing JSON. Sample:');
    for (const e of entries.slice(0, 5)) {
      console.log(`  ${e.codigoINE}  ${e.name.padEnd(30)}  ${e.province}, ${e.comunidadAutonoma}`);
    }
    return;
  }

  // Backup existing file
  if (existsSync(OUT_PATH)) {
    const oldRaw = readFileSync(OUT_PATH, 'utf8');
    const oldCount = JSON.parse(oldRaw).length;
    if (oldCount < entries.length) {
      const backup = OUT_PATH + '.bak';
      writeFileSync(backup, oldRaw);
      console.log(`  Backed up old ${oldCount}-entry file → ${path.basename(backup)}`);
    }
  }

  writeFileSync(OUT_PATH, JSON.stringify(entries, null, 2));
  console.log(`\nWrote ${entries.length} entries → ${OUT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
