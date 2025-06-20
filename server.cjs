#!/usr/bin/env node
'use strict';

/**
 * Production server launcher for Replit deployment
 * Uses CommonJS syntax for maximum compatibility
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const PORT = process.env.PORT || 5000;
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 seconds

// Simple HTML loading page
const loadingPage = `
<!DOCTYPE html>
<html>
  <head>
    <title>BeyondAsk - Application Starting</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
      h1 { color: #4F46E5; }
      .loading { display: flex; margin: 2rem 0; }
      .loading div { width: 12px; height: 12px; border-radius: 50%; background: #4F46E5; margin-right: 8px; animation: bounce 1.4s infinite ease-in-out both; }
      .loading div:nth-child(1) { animation-delay: -0.32s; }
      .loading div:nth-child(2) { animation-delay: -0.16s; }
      @keyframes bounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1.0); }
      }
    </style>
  </head>
  <body>
    <h1>BeyondAsk</h1>
    <p>Application is starting up... Please wait.</p>
    <div class="loading"><div></div><div></div><div></div></div>
    <p>This page will refresh automatically once the app is ready.</p>
    <script>
      setTimeout(() => { window.location.reload(); }, 10000);
    </script>
  </body>
</html>
`;

// Track child process
let mainApp = null;
let startAttempts = 0;

// Utility: Force kill process by port
function killProcessByPort(port) {
  console.log(`Attempting to kill process using port ${port}...`);
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', `FOR /F "tokens=5" %a in ('netstat -ano ^| findstr :${port} ^| findstr LISTENING') do taskkill /F /PID %a`]);
    } else {
      // For Linux/Mac
      const result = spawn('lsof', ['-i', `:${port}`, '-t']);
      result.stdout.on('data', (data) => {
        const pids = data.toString().trim().split('\n');
        pids.forEach(pid => {
          if (pid) {
            console.log(`Killing process ${pid} using port ${port}`);
            try {
              process.kill(parseInt(pid.trim(), 10), 'SIGKILL');
            } catch (err) {
              console.log(`Failed to kill process ${pid}: ${err.message}`);
            }
          }
        });
      });
    }
  } catch (error) {
    console.log(`Error killing process on port ${port}: ${error.message}`);
  }
}

// Start the real application
function startMainApplication() {
  if (startAttempts >= MAX_RETRIES) {
    console.error(`Failed to start application after ${MAX_RETRIES} attempts. Something is wrong.`);
    process.exit(1);
  }
  
  startAttempts++;
  console.log(`[Attempt ${startAttempts}/${MAX_RETRIES}] Starting main application...`);

  // Define command based on what's available
  let cmd, args;
  
  if (fs.existsSync('dist/index.js')) {
    console.log('Using built server (dist/index.js)...');
    cmd = 'node';
    args = ['dist/index.js'];
  } else {
    console.log('Using source server via tsx...');
    cmd = 'npx';
    args = ['tsx', 'server/index.ts'];
  }

  // Environment variables for the main app
  const env = { 
    ...process.env, 
    PORT: PORT.toString(),
    NODE_ENV: 'production',
    FORCE_VITE: 'true'
  };

  // Start the child process
  mainApp = spawn(cmd, args, { 
    env,
    stdio: 'inherit' // Forward all output
  });

  // Handle child process events
  mainApp.on('error', (err) => {
    console.error(`Failed to start main application: ${err.message}`);
    setTimeout(startMainApplication, RETRY_DELAY);
  });

  mainApp.on('exit', (code, signal) => {
    console.log(`Main application exited with code ${code} and signal ${signal}`);
    mainApp = null;
    
    if (code !== 0) {
      console.log('Application crashed, restarting...');
      setTimeout(startMainApplication, RETRY_DELAY);
    }
  });
}

// Create a temporary server for health checks
const tempServer = http.createServer((req, res) => {
  console.log(`Temporary server received request: ${req.method} ${req.url}`);
  
  // For health checks and API requests, return JSON
  if (req.url === '/health' || req.url.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'starting', 
      time: new Date().toISOString(),
      message: 'Application is starting, please wait...'
    }));
  } 
  // For root and other HTML requests, return the loading page
  else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(loadingPage);
  }
});

// First try to kill any process that might be using our port
killProcessByPort(PORT);

// Then attempt to start the temporary server
let tempServerRetries = 0;
const maxTempServerRetries = 3;

function startTempServer() {
  tempServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Temporary server listening on port ${PORT}`);
    
    // Build the application if needed
    if (!fs.existsSync('dist') || !fs.existsSync('dist/public/index.html')) {
      console.log('Build directory not found or incomplete. Running build process...');
      const build = spawn('node', ['build.js'], { stdio: 'inherit' });
      build.on('exit', (code) => {
        if (code !== 0) {
          console.error('Build failed!');
        } else {
          console.log('Build completed successfully');
        }
        // Start the main application regardless
        startMainApplication();
      });
    } else {
      console.log('Build directory exists. Skipping build step.');
      startMainApplication();
    }
  });
}

// Handle errors from the temporary server
tempServer.on('error', (err) => {
  console.error(`Temporary server error: ${err.message}`);
  
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use`);
    
    if (tempServerRetries < maxTempServerRetries) {
      tempServerRetries++;
      console.log(`Retrying to start temporary server (attempt ${tempServerRetries}/${maxTempServerRetries})...`);
      
      // Try to forcefully kill anything using our port
      killProcessByPort(PORT);
      
      // Try again after a delay
      setTimeout(startTempServer, 2000);
    } else {
      console.log(`Failed to start temporary server after ${maxTempServerRetries} attempts`);
      console.log('Assuming another instance is already running, starting main application directly');
      startMainApplication();
    }
  }
});

// Start the temporary server
startTempServer();

// Handle process termination
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down...`);
    
    if (tempServer) {
      tempServer.close();
    }
    
    if (mainApp) {
      mainApp.kill();
    }
    
    process.exit(0);
  });
});