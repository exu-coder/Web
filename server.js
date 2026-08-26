const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 10000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_DIR = path.join(PUBLIC_DIR, 'admin');
const ADMIN_INDEX = path.join(ADMIN_DIR, 'index.html');
const USER_INDEX = path.join(PUBLIC_DIR, 'index.html');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function safePath(base, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const target = path.resolve(base, '.' + decoded);
  const root = path.resolve(base);
  return target === root || target.startsWith(root + path.sep) ? target : null;
}

function sendFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(err.code === 'ENOENT' ? 'Not found' : 'Server error');
    }
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let url;
  try {
    url = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    return res.writeHead(400).end('Bad request');
  }

  // Normalize the admin route so /farabi@, /farabi@/, and encoded @ all work.
  const normalized = url.replace(/\/{2,}/g, '/');
  const adminRoot = normalized === '/farabi@' || normalized === '/farabi@/';
  const adminAsset = normalized.startsWith('/farabi@/');

  if (normalized === '/health') {
    return res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      .end(JSON.stringify({ ok: true, admin: '/farabi@/' }));
  }

  // ADMIN PANEL: /farabi@/
  if (adminRoot) {
    return sendFile(res, ADMIN_INDEX);
  }

  if (adminAsset) {
    const relative = normalized.slice('/farabi@'.length) || '/';
    const file = safePath(ADMIN_DIR, relative);
    if (!file) return res.writeHead(403).end('Forbidden');
    return sendFile(res, file);
  }

  // USER PANEL: everything else.
  const file = safePath(PUBLIC_DIR, normalized);
  if (!file) return res.writeHead(403).end('Forbidden');

  fs.stat(file, (err, stat) => {
    if (!err && stat.isFile()) return sendFile(res, file);
    return sendFile(res, USER_INDEX);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Farabi server listening on ${PORT}`);
  console.log('User panel: /');
  console.log('Admin panel: /farabi@/');
});
