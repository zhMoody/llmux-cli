#!/usr/bin/env node

import cp from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ext = process.platform === 'win32' ? '.exe' : '';
// The binary is downloaded into the bin/ folder by our postinstall script
const binFile = path.join(__dirname, `llmux${ext}`);

if (fs.existsSync(binFile)) {
  // 1. High Performance Native Path: Use the pre-compiled C++/Zig/Bun standalone binary
  const child = cp.spawnSync(binFile, process.argv.slice(2), { stdio: 'inherit' });
  if (child.error) {
    console.error("❌ Failed to launch downloaded binary:", child.error.message);
    process.exit(1);
  }
  process.exit(child.status ?? 1);
} else {
  // 2. Developer/Source Path: Try running directly with Bun (useful for local development or if download fails)
  const srcPath = path.join(__dirname, '../src/cli/index.ts');
  const child = cp.spawnSync('bun', ['run', srcPath, ...process.argv.slice(2)], { stdio: 'inherit' });
  
  if (child.error) {
    console.error("❌ LLMux executable not found and 'bun' is not installed locally or not in PATH.");
    console.error("Please run 'npm install -g llmux-cli' to auto-download the binary, or install the Bun runtime.");
    process.exit(1);
  }
  
  process.exit(child.status ?? 1);
}
