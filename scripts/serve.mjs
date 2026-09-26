import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { readHeaders, readRedirects, allowedImages, allowedMedia } from './policy.mjs';

// A loopback-only test server. Never serves repository files or executes code.
const root = await realpath(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 4321);
const headers = readHeaders(await readFile(path.join(root, '_headers'), 'utf8'));
const redirects = await readFile(path.join(root, '_redirects'), 'utf8').then(readRedirects, () => []);
const mime = { '.json': 'application/json', '.xml': 'application/xml', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8' };
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const moved = redirects.find(rule => rule.from === pathname);
    if (moved) { response.writeHead(moved.status, { ...headers, location: moved.to }).end(); return; }
    let file = path.resolve(root, `.${pathname}`);
    if (pathname.endsWith('/')) file = path.join(file, 'index.html');
    // Images and media are served only for the reviewed files.
    if (!file.startsWith(root + path.sep) || !mime[path.extname(file)] || (/\.(png|webp)$/.test(file) && !(pathname in allowedImages)) || (/\.(mp4|vtt)$/.test(file) && !(pathname in allowedMedia))) {
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
    const body = await readFile(file);
    // Byte ranges for the video, as the production host serves them (Safari requires them to play).
    const range = status === 200 && file.endsWith('.mp4') && /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '');
    if (range) {
      const start = range[1] ? Number(range[1]) : Math.max(0, body.length - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
      response.writeHead(206, { ...headers, 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${body.length}` });
      response.end(body.subarray(start, end + 1));
      return;
    }
    response.writeHead(status, { ...headers, 'content-type': mime[path.extname(file)], ...(file.endsWith('.mp4') ? { 'accept-ranges': 'bytes' } : {}) });
    response.end(body);
  } catch {
    response.writeHead(400, headers).end();
  }
}).listen(port, '127.0.0.1', () => console.log(`Static preview: http://127.0.0.1:${port}`));
