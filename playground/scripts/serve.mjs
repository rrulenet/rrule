import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const index = process.argv.indexOf('--port');
const port = index >= 0 ? Number(process.argv[index + 1]) : 4173;
const root = fileURLToPath(new URL('../site/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.md': 'text/plain', '.txt': 'text/plain' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/') { res.writeHead(302, { location: '/rrule/' }).end(); return; }
    if (!path.startsWith('/rrule/')) { res.writeHead(404).end(); return; }
    const file = resolve(root, path.slice('/rrule/'.length) || 'index.html');
    if (!file.startsWith(resolve(root) + sep) || !(await stat(file)).isFile()) { res.writeHead(404).end(); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    res.writeHead(200, { 'Content-Type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  } catch { res.writeHead(404).end(); }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/rrule/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
