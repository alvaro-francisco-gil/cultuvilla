import { slugifyFieldKey } from '@cultuvilla/shared/models/municipality/CensoTypes';
import type { FieldType, OptionsSource, ProfileFormField } from '@cultuvilla/shared/models/municipality/CensoTypes';

export type EditorAction =
  | { kind: 'addCustom'; type: FieldType }
  | { kind: 'addPredefined'; key: string }
  | { kind: 'remove'; index: number }
  | { kind: 'setLabel'; index: number; label: string }
  | { kind: 'setRequired'; index: number; required: boolean }
  | { kind: 'changeType'; index: number; type: FieldType }
  | { kind: 'setOptions'; index: number; options: string[] }
  | { kind: 'setSource'; index: number; source: OptionsSource }
  | { kind: 'move'; index: number; dir: -1 | 1 }
  | { kind: 'reset'; fields: ProfileFormField[] };

export function uniqueKey(base: string, existing: string[]): string {
  const safe = base || 'campo';
  if (!existing.includes(safe)) return safe;
  let i = 2;
  while (existing.includes(`${safe}_${i}`)) i += 1;
  return `${safe}_${i}`;
}

function isChoice(t: FieldType): boolean {
  return t === 'select' || t === 'multiselect';
}

export function censoEditorReducer(fields: ProfileFormField[], action: EditorAction): ProfileFormField[] {
  const next = fields.slice();
  switch (action.kind) {
    case 'addCustom':
      next.push({ source: 'custom', key: '', label: '', type: action.type, required: false,
        ...(isChoice(action.type) ? { options: [] } : {}) } as ProfileFormField);
      return next;
    case 'addPredefined':
      if (next.some((f) => f.key === action.key)) return next;
      next.push({ source: 'predefined', key: action.key, required: false } as ProfileFormField);
      return next;
    case 'remove':
      next.splice(action.index, 1);
      return next;
    case 'setLabel': {
      const f = next[action.index];
      if (f === undefined || f.source !== 'custom') return next;
      const others = next.filter((_, i) => i !== action.index).map((x) => x.key);
      next[action.index] = { ...f, label: action.label, key: uniqueKey(slugifyFieldKey(action.label), others) };
      return next;
    }
    case 'setRequired': {
      const f = next[action.index];
      if (f === undefined) return next;
      next[action.index] = { ...f, required: action.required };
      return next;
    }
    case 'changeType': {
      const f = next[action.index];
      if (f === undefined || f.source !== 'custom') return next;
      // Rebuild the field from scratch rather than spreading `undefined` onto
      // options/optionsSource: the Firebase callable encodes `undefined` as
      // `null`, which then fails the read schema. Omit the key instead.
      // Choice→choice (e.g. an entity select toggled to multiselect) keeps the
      // dynamic source; otherwise it becomes a static choice or non-choice.
      const nowChoice = isChoice(action.type);
      const base = { source: 'custom' as const, key: f.key, label: f.label, type: action.type, required: f.required };
      if (nowChoice && f.optionsSource !== undefined) {
        next[action.index] = { ...base, optionsSource: f.optionsSource };
      } else if (nowChoice) {
        next[action.index] = { ...base, options: f.options ?? [] };
      } else {
        next[action.index] = base;
      }
      return next;
    }
    case 'setOptions': {
      const f = next[action.index];
      if (f === undefined || f.source !== 'custom') return next;
      // Static options ⇒ no optionsSource. Omit the key (don't set undefined).
      next[action.index] = {
        source: 'custom', key: f.key, label: f.label, type: f.type,
        required: f.required, options: action.options,
      };
      return next;
    }
    case 'setSource': {
      const f = next[action.index];
      if (f === undefined || f.source !== 'custom') return next;
      // Dynamic source ⇒ no static options. Omit the key (don't set undefined).
      next[action.index] = {
        source: 'custom', key: f.key, label: f.label, type: f.type,
        required: f.required, optionsSource: action.source,
      };
      return next;
    }
    case 'move': {
      const j = action.index + action.dir;
      if (j < 0 || j >= next.length) return next;
      const tmp = next[action.index];
      const other = next[j];
      if (tmp === undefined || other === undefined) return next;
      next[action.index] = other;
      next[j] = tmp;
      return next;
    }
    case 'reset':
      return action.fields.slice();
    default:
      return next;
  }
}

/** index -> i18n error key suffix under censo.builder. */
export function fieldErrors(fields: ProfileFormField[]): Record<number, string> {
  const errs: Record<number, string> = {};
  fields.forEach((f, i) => {
    if (f.source !== 'custom') return;
    if (!f.label.trim()) { errs[i] = 'emptyLabel'; return; }
    if (isChoice(f.type)) {
      const hasStatic = Array.isArray(f.options) && f.options.length > 0;
      const hasSource = f.optionsSource !== undefined;
      if (!hasStatic && !hasSource) errs[i] = 'needsOptions';
    }
  });
  return errs;
}
