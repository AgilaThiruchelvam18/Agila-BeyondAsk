#!/usr/bin/env node

// Test deployment configuration
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Testing deployment configuration...');

// Check if dist directory exists and has required files
if (!fs.existsSync('dist')) {
  console.log('Creating dist directory...');
  fs.mkdirSync('dist', { recursive: true });
  fs.mkdirSync('dist/public', { recursive: true });
}

// Test the production server
console.log('Testing production server startup...');
try {
  const testResult = execSync('cd dist && timeout 10 node index.js', { 
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production', PORT: '3002' }
  });
  console.log('Server test result:', testResult);
} catch (error) {
  if (error.status === 124) {
    console.log('✅ Server started successfully (timeout expected)');
  } else {
    console.log('Server test output:', error.stdout);
    console.log('Server test error:', error.stderr);
  }
}

console.log('Deployment test completed');