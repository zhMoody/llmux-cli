import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

function getFiles(dir: string, fileList: string[] = []) {
  try {
    const files = readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      if (file.isDirectory()) {
        getFiles(join(dir, file.name), fileList);
      } else {
        fileList.push(join(dir, file.name));
      }
    }
  } catch (e) {
    // dir doesn't exist
  }
  return fileList;
}

const UI_DIR = join(process.cwd(), 'src', 'ui', 'dist');
const OUTPUT_FILE = join(process.cwd(), 'src', 'gateway', 'assets.ts');

console.log(`[PackAssets] Reading from ${UI_DIR}`);
const files = getFiles(UI_DIR);
const assets: Record<string, string> = {};

for (const file of files) {
  const relativePath = '/' + relative(UI_DIR, file).replace(/\\/g, '/');
  const content = readFileSync(file).toString('base64');
  assets[relativePath] = content;
}

const outputContent = `// Auto-generated file by pack-assets.ts. DO NOT EDIT.
export const ASSETS: Record<string, string> = ${JSON.stringify(assets, null, 2)};
`;

writeFileSync(OUTPUT_FILE, outputContent);
console.log(`✅ Packed ${Object.keys(assets).length} files into assets.ts (${(outputContent.length / 1024).toFixed(2)} KB)`);
