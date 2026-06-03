import { cpSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const env = process.argv[2];

if (!['dev', 'beta', 'prod'].includes(env ?? '')) {
  console.error('copy-well-known: usage: copy-well-known.mjs <dev|beta|prod>');
  process.exit(2);
}

const src = resolve(__dirname, `../public/.well-known/${env}`);
const dst = resolve(__dirname, `../public/.well-known`);
const target = (name) => resolve(dst, name);

if (!existsSync(src)) {
  console.error(`copy-well-known: missing source ${src}`);
  process.exit(1);
}

mkdirSync(dst, { recursive: true });
for (const name of ['apple-app-site-association', 'assetlinks.json']) {
  if (existsSync(target(name))) rmSync(target(name));
  cpSync(resolve(src, name), target(name));
}
console.log(`copy-well-known: copied ${env} files into public/.well-known/`);
