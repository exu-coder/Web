const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 10000;
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const ADMIN_DIR = path.join(PUBLIC_DIR, 'admin');
const USER_INDEX = path.join(PUBLIC_DIR, 'index.html');
const ADMIN_INDEX = path.join(ADMIN_DIR, 'index.html');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function safePath(base, requestPath) {
  const clean = requestPath.split('?')[0] || '/';
  let decoded;
  try { decoded = decodeURIComponent(clean); } catch { return null; }
  const root = path.resolve(base);
  const target = path.resolve(root, '.' + decoded);
  return target === root || target.startsWith(root + path.sep) ? target : null;
}

function sendFile(res, file) {
  fs.stat(file, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      res.writeHead(statErr && statErr.code === 'ENOENT' ? 404 : 500, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      return res.end(statErr && statErr.code === 'ENOENT' ? 'Not found' : 'Server error');
    }

    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    if (res.req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const rawUrl = req.url || '/';
  let url;
  try { url = decodeURIComponent(rawUrl.split('?')[0] || '/'); }
  catch { res.writeHead(400); return res.end('Bad request'); }

  const normalized = url.replace(/\/{2,}/g, '/');

  if (normalized === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ ok: true, user: '/', admin: '/farabi@/' }));
  }

  // Admin panel: /farabi@/ and /farabi@
  if (normalized === '/farabi@' || normalized === '/farabi@/') {
    return sendFile(res, ADMIN_INDEX);
  }

  // Admin assets: /farabi@/<file>
  if (normalized.startsWith('/farabi@/')) {
    const relative = normalized.slice('/farabi@'.length) || '/';
    const file = safePath(ADMIN_DIR, relative);
    if (!file) { res.writeHead(403); return res.end('Forbidden'); }
    return sendFile(res, file);
  }

  // User panel and public assets.
  const file = safePath(PUBLIC_DIR, normalized);
  if (!file) { res.writeHead(403); return res.end('Forbidden'); }

  fs.stat(file, (err, stat) => {
    if (!err && stat.isFile()) return sendFile(res, file);
    return sendFile(res, USER_INDEX);
  });
});

server.on('error', err => {
  console.error('Server error:', err);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Farabi IT Center server listening on port ${PORT}`);
  console.log('User panel: /');
  console.log('Admin panel: /farabi@/');
});
