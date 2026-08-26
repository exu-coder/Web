const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 10000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_DIR = path.join(PUBLIC_DIR, 'admin');

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
  return target.startsWith(path.resolve(base) + path.sep) || target === path.resolve(base) ? target : null;
}

function sendFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(err.code === 'ENOENT' ? 404 : 500).end('Not found');
    res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);

  if (url === '/health') return res.writeHead(200, {'Content-Type':'application/json'}).end(JSON.stringify({ok:true}));

  // Admin is ONLY available at /farabi@/.
  if (url === '/farabi@' || url === '/farabi@/') {
    return sendFile(res, path.join(ADMIN_DIR, 'index.html'));
  }
  if (url.startsWith('/farabi@/')) {
    const file = safePath(ADMIN_DIR, url.slice('/farabi@'.length));
    return file ? sendFile(res, file) : res.writeHead(403).end('Forbidden');
  }

  // Everything else is the user panel from public/.
  let file = safePath(PUBLIC_DIR, url);
  if (!file) return res.writeHead(403).end('Forbidden');
  fs.stat(file, (err, stat) => {
    if (!err && stat.isFile()) return sendFile(res, file);
    return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Farabi server listening on ${PORT}`));
