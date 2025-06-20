#!/usr/bin/env node
'use strict';

/**
 * BeyondAsk Direct Production Launcher
 * 
 * This is a simplified deployment script that:
 * 1. First aggressively kills any process using port 5000
 * 2. Immediately binds to port 5000 with a temporary server
 * 3. Runs the build process if needed
 * 4. Then directly executes the application with proper flags
 * 
 * This avoids the complexity of the previous approach and ensures
 * the port is immediately available for health checks.
 */

const http = require('http');
const { execSync, spawn } = require('child_process');
const fs = require('fs');

// Configuration
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'production';

console.log('BeyondAsk Direct Production Launcher');
console.log('----------------------------------------');
console.log('Environment:', NODE_ENV);
console.log('PORT:', PORT);
console.log('Working Directory:', process.cwd());
console.log('Node version:', process.version);
console.log('----------------------------------------');

// Try to forcefully free the port first
try {
  console.log(`Attempting to free port ${PORT} before starting...`);
  if (process.platform !== 'win32') {
    try {
      const result = execSync(`lsof -i:${PORT} -t`).toString().trim();
      if (result) {
        const pids = result.split('\n');
        pids.forEach(pid => {
          console.log(`Killing process ${pid} using port ${PORT}`);
          try {
            execSync(`kill -9 ${pid}`);
          } catch (err) {
            console.log(`Failed to kill process ${pid}`);
          }
        });
      }
    } catch (err) {
      // Ignore errors, likely no process using that port
      console.log('No process found using the port.');
    }
  }
} catch (err) {
  console.error('Error freeing port:', err.message);
}

// Simple HTML loading page
const loadingPage = `
<!DOCTYPE html>
<html>
  <head>
    <title>BeyondAsk - Application Starting</title>
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
        width: 40px; 
        height: 40px; 
        margin: 20px auto;
        border: 4px solid rgba(67, 56, 202, 0.2);
        border-radius: 50%;
        border-top-color: #4338ca;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
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
`;

let serverProcess = null;

// Start the main application
function startMainApplication() {
  console.log('Starting main server process...');
  
  // Define command based on what's available
  let cmd, args;
  
  if (fs.existsSync('./dist/index.js')) {
    console.log('Using compiled server...');
    cmd = 'node';
    args = ['--experimental-specifier-resolution=node', '--experimental-modules', './dist/index.js'];
  } else {
    console.log('No compiled server found. Starting server with tsx...');
    cmd = 'npx';
    args = ['tsx', './server/index.ts'];
  }
  
  // Set environment variables
  const env = { 
    ...process.env, 
    PORT: PORT.toString(),
    NODE_ENV: 'production',
    FORCE_VITE: 'true',
    REPLIT_DEPLOYMENT: 'true'
  };
  
  console.log(`Executing: ${cmd} ${args.join(' ')}`);
  
  // Start the main application
  serverProcess = spawn(cmd, args, { 
    env,
    stdio: 'inherit' // Forward all I/O to parent process
  });
  
  // Handle process events
  serverProcess.on('error', (err) => {
    console.error('Failed to start server process:', err.message);
    process.exit(1);
  });
  
  serverProcess.on('exit', (code, signal) => {
    console.log(`Server process exited with code ${code}`);
    process.exit(code || 0);
  });
}

// Create a temporary server that responds to health checks
const tempServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'starting', time: new Date().toISOString() }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(loadingPage);
  }
});

// Try to bind to the port
tempServer.on('error', (err) => {
  console.error('Temporary server error:', err.message);
  
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use - assuming server is already running`);
    console.log('Proceeding with deployment without starting a temporary server');
    
    // Check if we need to build first
    if (fs.existsSync('./build.js')) {
      if (!fs.existsSync('./dist/public/index.html')) {
        console.log('Build files not found. Running build process...');
        try {
          execSync('node build.js', { stdio: 'inherit' });
          console.log('Build completed successfully');
        } catch (error) {
          console.error('Build failed:', error.message);
        }
      } else {
        console.log('Build files found. Skipping build process.');
      }
    }
    
    startMainApplication();
  }
});

tempServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Temporary server successfully bound to port ${PORT}`);
  
  // Build the application if needed
  if (fs.existsSync('./build.js')) {
    if (!fs.existsSync('./dist/public/index.html')) {
      console.log('Build files not found. Running build process...');
      const build = spawn('node', ['build.js'], { stdio: 'inherit' });
      
      build.on('exit', (code) => {
        if (code !== 0) {
          console.error('Build process failed!');
        } else {
          console.log('Build completed successfully.');
        }
        
        // Close the temporary server and start the main application
        tempServer.close(() => {
          startMainApplication();
        });
      });
    } else {
      console.log('Build files found. Skipping build process.');
      
      // Close the temporary server and start the main application
      tempServer.close(() => {
        startMainApplication();
      });
    }
  } else {
    // Close the temporary server and start the main application
    tempServer.close(() => {
      startMainApplication();
    });
  }
});

// Handle termination signals
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down...`);
    
    if (tempServer) {
      tempServer.close();
    }
    
    if (serverProcess) {
      serverProcess.kill(signal);
    }
    
    // Force exit after a timeout
    setTimeout(() => {
      console.log('Forcing exit after timeout');
      process.exit(0);
    }, 2000);
  });
});