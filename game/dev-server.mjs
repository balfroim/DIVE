import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '0.0.0.0';

const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp']
]);

function contentType(path) {
  return types.get(extname(path)) || 'application/octet-stream';
}

function safePath(urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0]);
  const rel = decoded === '/' ? '/index.html' : decoded;
  const clean = normalize(rel).replace(/^([/\\])+/, '');
  return join(root, clean);
}

const server = createServer(async (req, res) => {
  try {
    const filePath = safePath(req.url);
    let finalPath = filePath;
    try {
      const info = await stat(filePath);
      if (info.isDirectory()) finalPath = join(filePath, 'index.html');
    } catch {
      if (!extname(filePath)) finalPath = join(root, 'index.html');
    }

    const data = await readFile(finalPath);
    res.writeHead(200, {
      'Content-Type': contentType(finalPath),
      'Cache-Control': 'no-store, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(data);
  } catch {
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0'
    });
    res.end('Not found');
  }
});

server.listen(port, host, () => {
  console.log(`dev server running at http://${host}:${port}/`);
});