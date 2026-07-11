// Renderiza los .md de la propuesta a PDF con estilo de marca.
// Uso: node render.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '../../..');

// Resolver marked / playwright desde el store pnpm si no están hoisteados.
function loadFromPnpm(pkg, sub) {
  try { return require(pkg); } catch { /* fall through */ }
  const pnpmDir = join(REPO, 'node_modules/.pnpm');
  const match = readdirSync(pnpmDir).find((d) => d.startsWith(pkg.replace('/', '+') + '@') || d.startsWith(pkg + '@'));
  if (!match) throw new Error(`No encuentro ${pkg} en .pnpm`);
  return require(join(pnpmDir, match, 'node_modules', pkg, sub));
}
const { marked } = loadFromPnpm('marked', 'lib/marked.cjs');
const { chromium } = loadFromPnpm('playwright', 'index.js');

const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const cultuvilla = b64(join(__dirname, 'assets/cultuvilla-logo.png'));
const mashumano = b64(join(__dirname, 'assets/mashumano-logo.png'));

const CSS = `
  :root{ --orange:#C15A32; --green:#4A6B41; --ink:#20261f; --muted:#5b6157; --line:#e3e0d8; }
  *{ box-sizing:border-box; }
  body{ font-family:"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:var(--ink);
        font-size:11pt; line-height:1.55; margin:0; }
  .cover{ display:flex; align-items:center; justify-content:space-between;
          padding-bottom:14px; margin-bottom:26px; }
  .cover .cv{ height:64px; } .cover .mh{ height:42px; opacity:.9; }
  h1{ color:var(--orange); font-size:22pt; margin:.2em 0 .1em; letter-spacing:-.3px; }
  h2{ color:var(--green); font-size:14pt; margin:1.4em 0 .4em; page-break-after:avoid; }
  h3{ color:var(--ink); font-size:12pt; margin:1em 0 .3em; page-break-after:avoid; }
  p,li{ margin:.35em 0; }
  strong{ color:var(--ink); }
  em{ color:var(--muted); }
  a{ color:var(--green); text-decoration:none; }
  table{ border-collapse:collapse; width:100%; margin:.8em 0; font-size:10pt; page-break-inside:avoid; }
  th{ background:var(--green); color:#fff; text-align:left; padding:7px 9px; }
  td{ border:1px solid var(--line); padding:6px 9px; vertical-align:top; }
  tr:nth-child(even) td{ background:#f7f6f2; }
  blockquote{ margin:.8em 0; padding:10px 16px; background:#faf3ee;
              border-left:4px solid var(--orange); color:#3a3a34; font-style:italic;
              page-break-inside:avoid; border-radius:0 6px 6px 0; }
  blockquote p{ margin:.2em 0; }
  code{ background:#fff2ea; color:var(--orange); padding:1px 5px; border-radius:4px;
        font-size:9.5pt; font-style:normal; }
  hr{ border:0; border-top:1px solid var(--line); margin:1.6em 0; }
  h2:first-of-type{ margin-top:.6em; }
`;

const files = ['plan-de-negocio.md', 'formulario.md'];

const browser = await chromium.launch();
for (const f of files) {
  const src = join(__dirname, f);
  if (!existsSync(src)) { console.log('skip (no existe):', f); continue; }
  let md = readFileSync(src, 'utf8');
  // La primera línea "# Título" la usamos como <h1>; el resto normal.
  const bodyHtml = marked.parse(md);
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <style>${CSS}</style></head><body>
    <div class="cover">
      <img class="cv" src="${cultuvilla}" alt="Cultuvilla"/>
      <img class="mh" src="${mashumano}" alt="Premio Jóvenes Máshumano"/>
    </div>
    ${bodyHtml}
  </body></html>`;
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  const out = src.replace(/\.md$/, '.pdf');
  await page.pdf({
    path: out, format: 'A4', printBackground: true,
    margin: { top: '16mm', bottom: '18mm', left: '16mm', right: '16mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate:
      '<div style="width:100%;font-size:8pt;color:#9a9a90;padding:0 16mm;display:flex;justify-content:space-between;">'
      + '<span>Cultuvilla · Premio Jóvenes Máshumano 2026</span>'
      + '<span>Pág. <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
  });
  await page.close();
  console.log('PDF:', out);
}
await browser.close();
