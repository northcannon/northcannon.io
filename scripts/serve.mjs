import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { readHeaders, readRedirects } from './policy.mjs';

// A loopback-only test server. Never serves repository files or executes code.
const root = await realpath(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 4321);
const headers = readHeaders(await readFile(path.join(root, '_headers'), 'utf8'));
const redirects = await readFile(path.join(root, '_redirects'), 'utf8').then(readRedirects, () => []);
const mime = { '.json': 'application/json', '.xml': 'application/xml', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const moved = redirects.find(rule => rule.from === pathname);
    if (moved) { response.writeHead(moved.status, { ...headers, location: moved.to }).end(); return; }
    let file = path.resolve(root, `.${pathname}`);
    if (pathname.endsWith('/')) file = path.join(file, 'index.html');
    if (!file.startsWith(root + path.sep) || !mime[path.extname(file)]) {
      response.writeHead(404, headers).end();
      return;
    }
    let status = 200;
    try {
      file = await realpath(file);
      if (!file.startsWith(root + path.sep)) throw new Error('Outside output');
    } catch {
      file = path.join(root, '404.html');
      status = 404;
    }
    response.writeHead(status, { ...headers, 'content-type': mime[path.extname(file)] });
    response.end(await readFile(file));
  } catch {
    response.writeHead(400, headers).end();
  }
}).listen(port, '127.0.0.1', () => console.log(`Static preview: http://127.0.0.1:${port}`));
