#!/usr/bin/env node
/**
 * Is the fiestas dataset still current, and how much of it rests on a source?
 *
 *   pnpm fiestas:verify            # report; exits 0 even when stale
 *   pnpm fiestas:verify --strict   # exits 1 when stale (the scheduled check)
 *
 * Deliberately NOT a hard gate in `pnpm check`. The staleness trips on a
 * calendar boundary, not on a diff, so failing every PR in October would red
 * `develop` for something nobody in that PR did — the trap
 * `business:snapshot:check` already falls into. `--strict` runs from
 * .github/workflows/fiestas-freshness.yml, which opens an issue instead.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FiestasDatasetSchema, minimumBopYear } from '../packages/shared/dist/models/business/BusinessSnapshot.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MERCADO = join(ROOT, 'project/mercado');
const today = () => new Date().toISOString().slice(0, 10);

export function datasetFiles(dir = MERCADO) {
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
}

function main() {
  const strict = process.argv.includes('--strict');
  const minimum = minimumBopYear(today());
  let stale = 0;

  for (const file of datasetFiles()) {
    const parsed = FiestasDatasetSchema.safeParse(JSON.parse(readFileSync(join(MERCADO, file), 'utf8')));
    if (!parsed.success) {
      console.error(`✗ ${file} does not match FiestasDatasetSchema:`);
      for (const issue of parsed.error.issues.slice(0, 10)) {
        console.error(`    ${issue.path.join('.')}: ${issue.message}`);
      }
      return 1;
    }
    const d = parsed.data;
    const fiestas = d.pueblos.flatMap((p) => p.fiestas);
    const verificadas = fiestas.filter((f) => f.tipo === 'verificada').length;
    const marcas = d.pueblos.flatMap((p) => p.confirmar ?? []).length;
    const sinRegla = fiestas.filter((f) => f.recurrencia === 'movil' && !f.regla).length;
    const outdated = d.anioBop < minimum;
    if (outdated) stale += 1;

    console.log(`${outdated ? '⚠' : '✓'} ${file}`);
    console.log(`    centro      ${d.cobertura.centro.nombre}  ·  radio ${String(d.cobertura.radioKm)} km  ·  ${String(d.pueblos.length)} pueblos`);
    console.log(`    barridos    ${d.cobertura.barridos.map((b) => `${b.fecha} @${String(b.radioKm)}km (BOP ${String(b.anioBop)})`).join(', ')}`);
    // Guarded: a dataset whose pueblos are all still blank is a legitimate
    // state (coverage recorded, nothing published yet) and must not print NaN%.
    const pct = fiestas.length === 0 ? '—' : `${String(Math.round((verificadas / fiestas.length) * 100))}%`;
    console.log(`    fiestas     ${String(fiestas.length)} · ${String(verificadas)} verificadas (${pct})`);
    console.log(`    pendientes  ${String(marcas)} [[confirmar]] · ${String(sinRegla)} fechas móviles sin regla`);
    if (outdated) {
      console.log(`    STALE       anioBop ${String(d.anioBop)} < ${String(minimum)} — el BOP de ${String(minimum)} ya debería estar publicado.`);
      console.log('                Refresh: use the `research-village-fiestas` skill (or the mercado-scout agent).');
    }
  }

  if (stale > 0 && strict) return 1;
  if (stale > 0) console.log(`\n${String(stale)} dataset(s) stale — not failing; run with --strict to gate.`);
  return 0;
}

process.exit(main());
