import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.env.PORT || 4173);
const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.mjs':'text/javascript', '.pdf':'application/pdf', '.svg':'image/svg+xml', '.txt':'text/plain' };
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': (types[extname(file)] || 'application/octet-stream') + (types[extname(file)] ? '; charset=utf-8' : ''), 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
    res.end(body);
  } catch { res.writeHead(404).end('No encontrado'); }
}).listen(port, '127.0.0.1', () => console.log(`AulaNexo: http://127.0.0.1:${port}`));
