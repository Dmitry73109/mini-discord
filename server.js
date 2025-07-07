const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3001 });

let clients = [];

wss.on('connection', function connection(ws) {
  ws.id = Math.random().toString(36).slice(2);
  clients.push(ws);

  ws.on('message', function incoming(msg) {
    let data;
    try { data = JSON.parse(msg); } catch { return; }
    clients.forEach(c => {
      if (c !== ws && c.readyState === WebSocket.OPEN) {
        c.send(JSON.stringify({ ...data, from: ws.id }));
      }
    });
  });

  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});

console.log('WebSocket signaling server running on ws://localhost:3001');
