#!/usr/bin/env node

const cp = require('child_process');
const path = require('path');
const fs = require('fs');

const ext = process.platform === 'win32' ? '.exe' : '';
// The binary is downloaded into the bin/ folder by our postinstall script
const binFile = path.join(__dirname, `llmux${ext}`);

if (fs.existsSync(binFile)) {
    // 1. High Performance Native Path: Use the pre-compiled C++/Zig/Bun standalone binary
    const child = cp.spawnSync(binFile, process.argv.slice(2), { stdio: 'inherit' });
    process.exit(child.status || 0);
} else {
    // 2. Developer/Source Path: Try running directly with Bun (useful for local development or if download fails)
    try {
        const srcPath = path.join(__dirname, '../src/cli/index.ts');
        const child = cp.spawnSync('bun', ['run', srcPath, ...process.argv.slice(2)], { stdio: 'inherit' });
        process.exit(child.status || 0);
    } catch (e) {
        console.error("❌ LLMux executable not found and 'bun' is not installed locally.");
        console.error("Please run 'npm install -g llmux-cli' to auto-download the binary, or install the Bun runtime.");
        process.exit(1);
    }
}
