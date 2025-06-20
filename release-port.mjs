// Simple utility to force-free port 5000
import { exec } from 'child_process';
import { createServer } from 'net';

const PORT = 5000;

console.log(`Attempting to release port ${PORT}...`);

// First attempt: Try to bind to the port to see if it's already free
const server = createServer();

server.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is in use. Attempting to force release...`);
    
    // On Linux/Mac, we can try to find the PID
    if (process.platform !== 'win32') {
      exec(`lsof -i :${PORT} -t || true`, (error, stdout) => {
        if (error) {
          console.log(`Could not find process using port ${PORT}: ${error.message}`);
          console.log('Continuing with deployment anyway...');
          process.exit(0);
          return;
        }
        
        const pids = stdout.trim().split('\n').filter(Boolean);
        if (pids.length === 0) {
          console.log(`No process found using port ${PORT}.`);
          console.log('Continuing with deployment anyway...');
          process.exit(0);
          return;
        }
        
        console.log(`Found processes using port ${PORT}: ${pids.join(', ')}`);
        pids.forEach(pid => {
          console.log(`Attempting to kill process ${pid}...`);
          try {
            process.kill(parseInt(pid, 10), 'SIGKILL');
            console.log(`Successfully killed process ${pid}`);
          } catch (killError) {
            console.log(`Failed to kill process ${pid}: ${killError.message}`);
          }
        });
        
        console.log('Port release attempt completed');
        process.exit(0);
      });
    } else {
      // On Windows, we can't easily get the PID, so just continue
      console.log('Cannot reliably identify processes using the port on this platform.');
      console.log('Continuing with deployment anyway...');
      process.exit(0);
    }
  } else {
    console.log(`Error checking port: ${err.message}`);
    console.log('Continuing with deployment anyway...');
    process.exit(0);
  }
});

server.once('listening', () => {
  console.log(`Port ${PORT} is free and available!`);
  server.close();
  process.exit(0);
});

server.listen(PORT, '0.0.0.0');

// Set a timeout to ensure we don't hang forever
setTimeout(() => {
  console.log('Timeout reached waiting for port check to complete');
  process.exit(0);
}, 5000);