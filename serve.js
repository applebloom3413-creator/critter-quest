// Tiny local web server for testing the game: node serve.js, then open http://localhost:8642
// (Phones on the same Wi-Fi can open http://<this PC's IP>:8642 too.)
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  // dev helper: POST a PNG data URL to /__snap?name=foo to save snapshots/foo.png
  if (req.method === 'POST' && url === '/__snap') {
    const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'snap').replace(/[^\w-]/g, '');
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      fs.mkdirSync(path.join(ROOT, 'snapshots'), { recursive: true });
      fs.writeFileSync(path.join(ROOT, 'snapshots', name + '.png'), Buffer.from(body.split(',')[1], 'base64'));
      res.end('ok');
    });
    return;
  }
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(8642, () => console.log('Critter Quest running at http://localhost:8642'));
