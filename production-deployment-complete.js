#!/usr/bin/env node

// Complete production deployment with comprehensive error handling
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Creating comprehensive production deployment...');

// Clean and create deployment
if (fs.existsSync('dist')) execSync('rm -rf dist');
fs.mkdirSync('dist', { recursive: true });

// Create production frontend with proper error handling
const frontend = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BeyondAsk AI Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; min-height: 100vh; }
        .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
        .header { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; margin-bottom: 2rem; }
        h1 { color: #1e293b; margin-bottom: 1rem; font-size: 2rem; }
        .status { margin: 1rem 0; padding: 1rem; background: #f1f5f9; border-radius: 4px; }
        .links { display: flex; gap: 1rem; justify-content: center; margin-top: 1rem; }
        .link { color: #3b82f6; text-decoration: none; padding: 0.5rem 1rem; border: 1px solid #3b82f6; border-radius: 4px; transition: all 0.2s; }
        .link:hover { background: #3b82f6; color: white; }
        .error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .info { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
        .loading { display: inline-block; width: 20px; height: 20px; border: 3px solid #e2e8f0; border-radius: 50%; border-top-color: #3b82f6; animation: spin 1s ease-in-out infinite; margin-right: 0.5rem; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>BeyondAsk AI Platform</h1>
            <div class="status info" id="status">
                <div class="loading"></div>
                Connecting to server...
            </div>
            <div class="links">
                <a href="/api/health" class="link">Health Check</a>
                <a href="/api-docs" class="link">API Documentation</a>
                <a href="/api/agents" class="link">Agents API</a>
            </div>
        </div>
    </div>
    
    <script>
        let retryCount = 0;
        const maxRetries = 30;
        
        function updateStatus(message, type = 'info') {
            const statusEl = document.getElementById('status');
            statusEl.className = 'status ' + type;
            statusEl.innerHTML = message;
        }
        
        function checkServerHealth() {
            fetch('/api/health')
                .then(response => {
                    if (!response.ok) throw new Error('Server responded with ' + response.status);
                    return response.json();
                })
                .then(data => {
                    updateStatus(
                        '<strong>Server Online</strong><br>' +
                        'Status: ' + data.status + '<br>' +
                        'Environment: ' + data.environment + '<br>' +
                        'Uptime: ' + Math.round(data.uptime) + 's',
                        'success'
                    );
                })
                .catch(error => {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        updateStatus(
                            '<div class="loading"></div>' +
                            'Connecting to server... (attempt ' + retryCount + '/' + maxRetries + ')',
                            'info'
                        );
                        setTimeout(checkServerHealth, 2000);
                    } else {
                        updateStatus(
                            '<strong>Connection Failed</strong><br>' +
                            'Unable to connect to the server after ' + maxRetries + ' attempts.<br>' +
                            'Please check the deployment status.',
                            'error'
                        );
                    }
                });
        }
        
        // Start health check after 1 second
        setTimeout(checkServerHealth, 1000);
    </script>
</body>
</html>`;

fs.mkdirSync('dist/public', { recursive: true });
fs.writeFileSync('dist/public/index.html', frontend);

// Function to copy and fix TypeScript files
function copyAndFixFile(srcPath, destPath) {
  let content = fs.readFileSync(srcPath, 'utf8');
  
  // Fix TypeScript type imports that cause ES module errors
  content = content.replace(/import\s*{([^}]*)\btype\s+(\w+)([^}]*)\}/g, 
    (match, before, typeName, after) => {
      const cleanBefore = before.replace(/,\s*$/, '').trim();
      const cleanAfter = after.replace(/^\s*,/, '').trim();
      const parts = [];
      if (cleanBefore) parts.push(cleanBefore);
      parts.push(typeName);
      if (cleanAfter) parts.push(cleanAfter);
      return `import { ${parts.join(', ')} }`;
    }
  );
  
  // Fix standalone type imports
  content = content.replace(/import\s*{\s*type\s+(\w+)\s*}\s*from/g, 'import { $1 } from');
  
  // Fix Vite type errors
  content = content.replace(/allowedHosts:\s*true,/g, 'allowedHosts: true as const,');
  content = content.replace(/middlewareMode:\s*true,/g, 'middlewareMode: true as const,');
  
  fs.writeFileSync(destPath, content);
}

// Recursively copy and fix directories
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const items = fs.readdirSync(src);
  
  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else if (item.endsWith('.ts') || item.endsWith('.js')) {
      copyAndFixFile(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy all necessary files
copyDirectory('server', 'dist/server');
copyDirectory('shared', 'dist/shared');
copyDirectory('client', 'dist/client');

// Copy configuration files
const configFiles = ['vite.config.ts', 'tsconfig.json', 'tailwind.config.ts', 'postcss.config.js'];
for (const file of configFiles) {
  if (fs.existsSync(file)) {
    copyAndFixFile(file, path.join('dist', file));
  }
}

// Create required directories for dependencies
const requiredDirs = ['dist/test/data', 'dist/uploads', 'dist/temp'];
for (const dir of requiredDirs) {
  fs.mkdirSync(dir, { recursive: true });
}

// Create dummy file for pdf-parse
fs.writeFileSync('dist/test/data/05-versions-space.pdf', 'dummy file for pdf-parse');

// Create production package.json
const originalPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const prodPkg = {
  "name": "beyondask-production",
  "version": "1.0.0",
  "type": "module",
  "main": "start.mjs",
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "start": "node start.mjs",
    "health": "curl -f http://localhost:$PORT/health || exit 1"
  },
  "dependencies": originalPkg.dependencies
};

fs.writeFileSync('dist/package.json', JSON.stringify(prodPkg, null, 2));

// Create production startup script with comprehensive error handling
const startScript = `// Production server startup with comprehensive error handling
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Starting BeyondAsk production server...');

// Production environment setup
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '5000';
process.env.HOST = '0.0.0.0';

// Enhanced error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

// Startup timeout protection
const startupTimeout = setTimeout(() => {
  console.error('Server startup timeout (60s exceeded)');
  process.exit(1);
}, 60000);

console.log('Environment: production');
console.log('Port:', process.env.PORT);
console.log('Host: 0.0.0.0');
console.log('Working directory:', process.cwd());

// Start server with tsx
const server = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.PORT || '5000',
    HOST: '0.0.0.0'
  },
  cwd: __dirname
});

server.on('spawn', () => {
  console.log('Server process spawned successfully');
  clearTimeout(startupTimeout);
});

server.on('exit', (code, signal) => {
  clearTimeout(startupTimeout);
  console.log('Server process exited - Code:', code, 'Signal:', signal);
  process.exit(code || 0);
});

server.on('error', (error) => {
  clearTimeout(startupTimeout);
  console.error('Server process error:', error.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.kill('SIGINT');
});

console.log('Production server starting on 0.0.0.0:' + process.env.PORT);
`;

fs.writeFileSync('dist/start.mjs', startScript);

// Create deployment README
const readme = `# BeyondAsk Production Deployment

## Production Ready Features
- Complete dependency management
- ES module compatibility
- TypeScript error resolution
- Comprehensive error handling
- Health monitoring endpoint

## Quick Start
\`\`\`bash
npm install
npm start
\`\`\`

## Environment Variables
Set these in your deployment platform:
- DATABASE_URL (PostgreSQL)
- PINECONE_API_KEY
- PINECONE_ENVIRONMENT
- OPENAI_API_KEY
- SENDGRID_API_KEY

## Health Checks
- GET /health
- GET /api/health

## Server Configuration
- Binds to 0.0.0.0 for deployment compatibility
- Default port: 5000 (configurable via PORT env var)
- Production environment optimized
`;

fs.writeFileSync('dist/README.md', readme);

console.log('Comprehensive production deployment completed!');
console.log('');
console.log('Fixed issues:');
console.log('- TypeScript type compatibility errors');
console.log('- ES module syntax issues');
console.log('- Missing configuration files');
console.log('- Production error handling');
console.log('- Server binding configuration');
console.log('');
console.log('Deployment package ready in dist/ directory');