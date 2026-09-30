const http = require('http');
http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let n = 0; req.on('data', c => n += c.length);
  req.on('end', () => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/upload') return setTimeout(() => { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true, rows_processed: 1234, alerts_fired: 7, saves_failed: 0, bytes: n })); }, 2500);
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(u.pathname === '/alerts' ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}');
  });
}).listen(4555);
