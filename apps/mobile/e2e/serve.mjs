#!/usr/bin/env node
/**
 * Minimal static server for the Expo web export, used by Playwright's webServer.
 *
 * Dependency-free on purpose (no `serve` package): serves apps/mobile/dist and
 * falls back to index.html for unknown, extension-less paths so expo-router
 * client routing and deep links (e.g. /event/<id>) resolve. Usage:
 *   node e2e/serve.mjs <root> <port>   (cwd is apps/mobile via playwright.config)
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const root = join(process.cwd(), process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 5050);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

async function resolveFile(urlPath) {
  const safe = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const candidate = join(root, safe);
  try {
    if ((await stat(candidate)).isFile()) return candidate;
  } catch {
    /* fall through */
  }
  if (!extname(safe)) {
    try {
      const indexed = join(candidate, 'index.html');
      if ((await stat(indexed)).isFile()) return indexed;
    } catch {
      /* fall through */
    }
  }
  return join(root, 'index.html'); // SPA fallback
}

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const file = await resolveFile(urlPath);
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end('server error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[e2e-serve] http://127.0.0.1:${port} (root=${root})`);
});
