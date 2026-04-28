import { $ } from "bun";
import { rm, mkdir, rename, cp } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

console.log("🚀 Starting LLMux release build...");

// 1. Build UI
console.log("📦 Building UI...");
await $`cd ui && bun run build`;

// 2. Pack assets
console.log("🗜️ Packing UI assets into binary...");
await $`bun run pack-assets.ts`;

// 3. Prepare release directory
const releaseDir = join(process.cwd(), "release");
if (existsSync(releaseDir)) {
  await rm(releaseDir, { recursive: true, force: true });
}
await mkdir(releaseDir);

// 4. Compile standalone binaries for multiple platforms
console.log("🛠️ Compiling cross-platform standalone binaries...");
const targets = [
  { target: "bun-windows-x64", ext: ".exe", suffix: "windows-x64" },
  { target: "bun-linux-x64", ext: "", suffix: "linux-x64" },
  { target: "bun-linux-arm64", ext: "", suffix: "linux-arm64" },
  { target: "bun-darwin-x64", ext: "", suffix: "macos-x64" },
  { target: "bun-darwin-arm64", ext: "", suffix: "macos-arm64" },
];

for (const t of targets) {
  const outName = `llmux-${t.suffix}${t.ext}`;
  console.log(`   -> Target: ${t.target} (${outName})`);
  await $`bun build src/cli/index.ts --compile --target=${t.target} --minify --outfile ${join(releaseDir, outName)}`;
}

console.log("✅ Release created successfully in 'release' folder!");
