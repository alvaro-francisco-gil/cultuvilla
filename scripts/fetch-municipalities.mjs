#!/usr/bin/env node
/**
 * fetch-municipalities.mjs
 *
 * Queries Wikidata for every Spanish municipality (Q2074737) with an
 * INE code (P772) and writes the result to scripts/data/municipalities-es.json.
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

const SPARQL = `
SELECT ?muni ?muniLabel ?ine WHERE {
  ?muni wdt:P31 wd:Q2074737 .
  ?muni wdt:P772 ?ine .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
`.trim();

async function fetchSparql() {
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(SPARQL);
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json' },
  });
  if (!res.ok) throw new Error(`SPARQL ${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.results.bindings.map(b => ({
    qid: b.muni.value.split('/').pop(),
    name: b.muniLabel?.value ?? '',
    ine: b.ine.value,
  }));
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

  // Sanity: Spain has 8,131 municipios as of 2024
  const EXPECTED = 8131;
  const gap = EXPECTED - entries.length;
  console.log(`  Expected ~${EXPECTED}, got ${entries.length} (gap: ${gap}).`);

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
