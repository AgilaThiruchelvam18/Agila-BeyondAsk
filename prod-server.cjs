#!/usr/bin/env node
'use strict';

/**
 * BeyondAsk Production Server Launcher
 * Simplified without port release mechanism - direct launch
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

// Configuration
const PORT = process.env.PORT || 5000;
let serverProcess = null;

console.log('Starting BeyondAsk production launcher...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('PORT:', PORT);
console.log('Working Directory:', process.cwd());

// Create a temporary loading server
const tempServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'starting' }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>BeyondAsk - Starting</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="refresh" content="5">
          <style>
            body { 
              font-family: -apple-system, sans-serif; 
              max-width: 600px; 
              margin: 50px auto; 
              padding: 20px; 
              text-align: center; 
            }
            h1 { color: #4338ca; }
            .loader { 
              display: inline-block; 
              width: 80px; 
              height: 80px; 
              margin: 20px auto;
            }
            .loader:after {
              content: " ";
              display: block;
              width: 40px;
              height: 40px;
              margin: 8px;
              border-radius: 50%;
              border: 6px solid #4338ca;
              border-color: #4338ca transparent #4338ca transparent;
              animation: loader 1.2s linear infinite;
            }
            @keyframes loader {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <h1>BeyondAsk</h1>
          <p>Application is starting up...</p>
          <div class="loader"></div>
          <p>This page will refresh automatically</p>
        </body>
      </html>
    `);
  }
});

// Start the temporary server, then launch the real server
function startDeployment() {
  console.log('Starting server in production mode...');
  
  // Find the best way to start the server
  let command, args;
  
  if (fs.existsSync('./dist/index.js')) {
    console.log('Found server at: ./dist/index.js');
    command = 'node';
    args = ['--experimental-specifier-resolution=node', '--experimental-modules', './dist/index.js'];
  } else {
    console.log('No compiled server found, using tsx to run TypeScript directly');
    command = 'npx';
    args = ['tsx', './server/index.ts'];
  }
  
  console.log(`Launching server with: ${command} ${args.join(' ')}`);
  console.log('Using PORT:', PORT);
  
  // Set the environment variables
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: PORT.toString(),
    FORCE_VITE: 'true'
  };
  
  // Start the server
  serverProcess = spawn(command, args, {
    env,
    stdio: 'inherit'
  });
  
  // Handle server events
  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
  
  serverProcess.on('exit', (code, signal) => {
    console.log(`Server exited with code ${code} and signal ${signal}`);
    // Don't restart automatically to avoid deployment loops
    process.exit(code || 0);
  });
}

// Try to start the temporary server
tempServer.once('error', (err) => {
  console.log('Could not start temporary server:', err.message);
  
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use - assuming server is already running`);
    console.log('Proceeding with deployment without starting a temporary server');
  }
  
  // If there's a build.js file, run it first
  if (fs.existsSync('./build.js')) {
    if (!fs.existsSync('./dist') || !fs.existsSync('./dist/public/index.html')) {
      console.log('Build files not found. Running build process...');
      const build = spawn('node', ['build.js'], { stdio: 'inherit' });
      build.on('exit', (code) => {
        if (code !== 0) {
          console.error('Build failed with code', code);
        } else {
          console.log('Build completed successfully');
        }
        startDeployment();
      });
    } else {
      console.log('Build files found. Skipping build process.');
      startDeployment();
    }
  } else {
    startDeployment();
  }
});

tempServer.once('listening', () => {
  console.log(`Temporary server listening on port ${PORT}`);
  
  // If there's a build.js file, run it first
  if (fs.existsSync('./build.js')) {
    if (!fs.existsSync('./dist') || !fs.existsSync('./dist/public/index.html')) {
      console.log('Build files not found. Running build process...');
      const build = spawn('node', ['build.js'], { stdio: 'inherit' });
      build.on('exit', (code) => {
        if (code !== 0) {
          console.error('Build failed with code', code);
          tempServer.close(() => {
            process.exit(1);
          });
        } else {
          console.log('Build completed successfully');
          tempServer.close(() => {
            startDeployment();
          });
        }
      });
    } else {
      console.log('Build files found. Skipping build process.');
      tempServer.close(() => {
        startDeployment();
      });
    }
  } else {
    tempServer.close(() => {
      startDeployment();
    });
  }
});

// Try to bind to the port
tempServer.listen(PORT, '0.0.0.0');

// Handle process signals
process.on('SIGTERM', () => {
  console.log('SIGTERM received, forwarding to server process');
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, forwarding to server process');
  if (serverProcess) {
    serverProcess.kill('SIGINT');
  }
  process.exit(0);
});