const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const LIKES_FILE = path.join(__dirname, 'likes.json');

// Initialize likes.json if missing
if (!fs.existsSync(LIKES_FILE)) {
  fs.writeFileSync(LIKES_FILE, JSON.stringify({}));
}

let likesData = {};
try {
  likesData = JSON.parse(fs.readFileSync(LIKES_FILE, 'utf8'));
} catch (e) {
  likesData = {};
}

function saveLikesData() {
  try {
    fs.writeFileSync(LIKES_FILE, JSON.stringify(likesData, null, 2));
  } catch (e) {
    console.error('Error saving likes.json:', e);
  }
}

// Basic IP Rate Limiting (max 60 requests per minute per IP)
const ipRequests = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60000;
  const maxReqs = 60;

  let record = ipRequests.get(ip);
  if (!record || now - record.startTime > windowMs) {
    record = { count: 1, startTime: now };
    ipRequests.set(ip, record);
    return false;
  }

  record.count++;
  if (record.count > maxReqs) {
    return true;
  }
  return false;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  // API Route: GET /api/likes
  if (req.method === 'GET' && req.url.startsWith('/api/likes')) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(likesData));
    return;
  }

  // API Route: POST /api/like
  if (req.method === 'POST' && req.url.startsWith('/api/like')) {
    if (isRateLimited(ip)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too many requests. Please try again later.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const url = payload.url;
        const action = payload.action || 'like';

        if (!url) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing portfolio URL' }));
          return;
        }

        let count = likesData[url] || 0;
        if (action === 'unlike') {
          count = Math.max(0, count - 1);
        } else {
          count += 1;
        }

        likesData[url] = count;
        saveLikesData();

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ success: true, url, likes: count }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // Serve Static Files
  let safePath = path.normalize(req.url.split('?')[0]).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
