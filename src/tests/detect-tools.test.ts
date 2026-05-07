import { expect, test, describe } from 'bun:test';
import { detectInstalledTools, detectWithDeps, type DetectDeps } from '../services/detect-tools.js';

function makeDeps(opts: {
  platform: NodeJS.Platform;
  env?: Record<string, string | undefined>;
  commands?: Set<string>;
  files?: Set<string>;
}): DetectDeps {
  return {
    platform: opts.platform,
    env: opts.env ?? {},
    commandExists: async (cmd) => opts.commands?.has(cmd) ?? false,
    fileExists: async (path) => opts.files?.has(path) ?? false,
  };
}

describe('detectWithDeps - macOS', () => {
  test('全部都在 PATH 里', async () => {
    const result = await detectWithDeps(makeDeps({
      platform: 'darwin',
      commands: new Set(['code', 'claude', 'gemini', 'opencode']),
    }));
    expect(result).toEqual({ vscode: true, claude: true, gemini: true, opencode: true });
  });

  test('VSCode 装了但没注册 code 命令 - 通过 /Applications 兜底', async () => {
    const result = await detectWithDeps(makeDeps({
      platform: 'darwin',
      commands: new Set(['claude']),
      files: new Set(['/Applications/Visual Studio Code.app/Contents/MacOS/Electron']),
    }));
    expect(result.vscode).toBe(true);
    expect(result.claude).toBe(true);
    expect(result.gemini).toBe(false);
    expect(result.opencode).toBe(false);
  });

  test('啥都没装', async () => {
    const result = await detectWithDeps(makeDeps({ platform: 'darwin' }));
    expect(result).toEqual({ vscode: false, claude: false, gemini: false, opencode: false });
  });
});

describe('detectWithDeps - Windows', () => {
  test('全部都在 PATH 里', async () => {
    const result = await detectWithDeps(makeDeps({
      platform: 'win32',
      commands: new Set(['code', 'claude', 'gemini', 'opencode']),
    }));
    expect(result).toEqual({ vscode: true, claude: true, gemini: true, opencode: true });
  });

  test('VSCode 装在默认路径但 PATH 没有 - 通过 LOCALAPPDATA 兜底', async () => {
    const localAppData = 'C:\\Users\\test\\AppData\\Local';
    const result = await detectWithDeps(makeDeps({
      platform: 'win32',
      env: { LOCALAPPDATA: localAppData },
      files: new Set([`${localAppData}\\Programs\\Microsoft VS Code\\Code.exe`]),
    }));
    expect(result.vscode).toBe(true);
  });

  test('LOCALAPPDATA 未设置 - VSCode 检测不到', async () => {
    const result = await detectWithDeps(makeDeps({
      platform: 'win32',
      env: {},
    }));
    expect(result.vscode).toBe(false);
  });

  test('claude/gemini/opencode 都在 PATH', async () => {
    const result = await detectWithDeps(makeDeps({
      platform: 'win32',
      commands: new Set(['claude', 'gemini', 'opencode']),
    }));
    expect(result.claude).toBe(true);
    expect(result.gemini).toBe(true);
    expect(result.opencode).toBe(true);
    expect(result.vscode).toBe(false);
  });
});

describe('detectWithDeps - Linux', () => {
  test('全部都在 PATH 里', async () => {
    const result = await detectWithDeps(makeDeps({
      platform: 'linux',
      commands: new Set(['code', 'claude', 'gemini', 'opencode']),
    }));
    expect(result).toEqual({ vscode: true, claude: true, gemini: true, opencode: true });
  });

  test('VSCode 不在 PATH - 不会走 /Applications 兜底', async () => {
    const result = await detectWithDeps(makeDeps({
      platform: 'linux',
      files: new Set(['/Applications/Visual Studio Code.app/Contents/MacOS/Electron']),
    }));
    expect(result.vscode).toBe(false);
  });

  test('只装了 claude', async () => {
    const result = await detectWithDeps(makeDeps({
      platform: 'linux',
      commands: new Set(['claude']),
    }));
    expect(result).toEqual({ vscode: false, claude: true, gemini: false, opencode: false });
  });
});

describe('detectInstalledTools - 真实环境', () => {
  test('在当前机器跑一次（仅打印）', async () => {
    const result = await detectInstalledTools();
    console.log('\n[当前机器 platform:', process.platform, ']');
    console.log('  VSCode   :', result.vscode);
    console.log('  Claude   :', result.claude);
    console.log('  Gemini   :', result.gemini);
    console.log('  OpenCode :', result.opencode);

    expect(typeof result.vscode).toBe('boolean');
    expect(typeof result.claude).toBe('boolean');
    expect(typeof result.gemini).toBe('boolean');
    expect(typeof result.opencode).toBe('boolean');
  });
});
