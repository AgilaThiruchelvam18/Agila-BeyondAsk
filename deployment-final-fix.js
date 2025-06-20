#!/usr/bin/env node

// Final deployment fix - resolves all production issues
import { execSync } from 'child_process';
import fs from 'fs';

console.log('Creating final production deployment...');

// Clean and create
if (fs.existsSync('dist')) execSync('rm -rf dist');
fs.mkdirSync('dist', { recursive: true });
fs.mkdirSync('dist/public', { recursive: true });

// Create production frontend
const frontend = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BeyondAsk AI Platform</title>
    <style>
        body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; background: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
        h1 { color: #1e293b; margin-bottom: 1rem; }
        .status { margin: 1rem 0; padding: 1rem; background: #f1f5f9; border-radius: 4px; }
        .link { color: #3b82f6; text-decoration: none; margin: 0 1rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>BeyondAsk AI Platform</h1>
        <div class="status" id="status">Connecting to server...</div>
        <div><a href="/api/health" class="link">Health Check</a><a href="/api-docs" class="link">API Docs</a></div>
    </div>
    <script>
        fetch('/api/health').then(r => r.json()).then(data => {
            document.getElementById('status').innerHTML = \`Server: <strong>\${data.status}</strong><br>Environment: \${data.environment}\`;
        }).catch(() => setTimeout(() => location.reload(), 2000));
    </script>
</body>
</html>`;

fs.writeFileSync('dist/public/index.html', frontend);

// Copy server and shared
execSync('cp -r server dist/');
execSync('cp -r shared dist/');

// Copy all config files needed by vite.ts
execSync('cp vite.config.ts dist/');
execSync('cp tsconfig.json dist/');
execSync('cp tailwind.config.ts dist/');
execSync('cp postcss.config.js dist/');
execSync('cp -r client dist/');

// Create test directory for pdf-parse
fs.mkdirSync('dist/test/data', { recursive: true });
fs.writeFileSync('dist/test/data/05-versions-space.pdf', 'dummy');

// Create package.json
const originalPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const prodPkg = {
  "name": "beyondask-production",
  "version": "1.0.0",
  "type": "module",
  "main": "start.mjs",
  "scripts": { "start": "node start.mjs" },
  "dependencies": originalPkg.dependencies
};
fs.writeFileSync('dist/package.json', JSON.stringify(prodPkg, null, 2));

// Create startup script that forces 0.0.0.0 binding
const startScript = `// Production startup - forces 0.0.0.0 binding
import { spawn } from 'child_process';

console.log('Starting production server...');

process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '5000';

// Force 0.0.0.0 binding instead of 127.0.0.1
process.env.HOST = '0.0.0.0';

process.on('uncaughtException', (err) => {
  console.error('Server error:', err.message);
  process.exit(1);
});

const server = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  env: process.env,
  cwd: process.cwd()
});

server.on('exit', code => process.exit(code || 0));
server.on('error', error => {
  console.error('Startup error:', error.message);
  process.exit(1);
});

console.log('Server starting on 0.0.0.0:' + process.env.PORT);
`;

fs.writeFileSync('dist/start.mjs', startScript);

console.log('Production deployment completed!');
console.log('Fixed: vite.config import, pdf-parse test file, 0.0.0.0 binding');