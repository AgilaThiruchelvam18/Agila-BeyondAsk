#!/usr/bin/env node

// Fix production deployment by copying missing files and fixing imports
import { execSync } from 'child_process';
import fs from 'fs';

console.log('Fixing production deployment...');

// Copy missing configuration files to dist
if (fs.existsSync('vite.config.ts')) {
  execSync('cp vite.config.ts dist/', { stdio: 'inherit' });
}

if (fs.existsSync('postcss.config.js')) {
  execSync('cp postcss.config.js dist/', { stdio: 'inherit' });
}

if (fs.existsSync('tailwind.config.ts')) {
  execSync('cp tailwind.config.ts dist/', { stdio: 'inherit' });
}

if (fs.existsSync('tsconfig.json')) {
  execSync('cp tsconfig.json dist/', { stdio: 'inherit' });
}

// Copy client directory for Vite development server
if (fs.existsSync('client')) {
  execSync('cp -r client dist/', { stdio: 'inherit' });
}

// Copy node_modules tsx for production
if (fs.existsSync('node_modules/tsx')) {
  fs.mkdirSync('dist/node_modules', { recursive: true });
  execSync('cp -r node_modules/tsx dist/node_modules/', { stdio: 'inherit' });
}

console.log('Production deployment fixed successfully!');
console.log('Missing configuration files and dependencies copied to dist/');