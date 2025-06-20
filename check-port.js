const net = require('net');

// Try to bind to port 5000
const server = net.createServer();

server.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('Port 5000 is already in use.');
  } else {
    console.log('Error checking port:', err.message);
  }
});

server.once('listening', () => {
  console.log('Port 5000 is available.');
  server.close();
});

server.listen(5000, '0.0.0.0');