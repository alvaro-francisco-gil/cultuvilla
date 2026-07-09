/**
 * Curated, stable occupation keys for a Spanish village community.
 *
 * These are language-neutral identifiers, not display text — labels live in
 * `packages/i18n/messages/es.json` under `occupations.catalog.<key>`. Keys
 * are permanent once shipped: they may be referenced by stored data, so
 * renaming a key is a breaking change (add a new key instead).
 */
export const OCCUPATION_CATALOG = [
  'agricultor',
  'ganadero',
  'profesor',
  'medico',
  'enfermero',
  'hosteleria',
  'construccion',
  'comerciante',
  'funcionario',
  'estudiante',
  'jubilado',
  'autonomo',
  'administrativo',
  'transportista',
  'electricista',
  'fontanero',
  'mecanico',
  'panadero',
  'peluquero',
  'limpieza',
  'veterinario',
  'abogado',
  'arquitecto',
  'ingeniero',
  'cocinero',
  'camarero',
  'albanil',
  'carpintero',
  'informatico',
  'artesano',
  'desempleado',
  'ama-de-casa',
  'otro',
] as const;

export function isCatalogOccupation(value: string): boolean {
  return (OCCUPATION_CATALOG as readonly string[]).includes(value);
}

export function occupationI18nKey(key: string): string {
  return `occupations.catalog.${key}`;
}
