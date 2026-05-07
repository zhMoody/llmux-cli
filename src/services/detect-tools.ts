export interface DetectedTools {
  vscode: boolean;
  claude: boolean;
  gemini: boolean;
  opencode: boolean;
}

export interface DetectDeps {
  platform: NodeJS.Platform;
  env: Record<string, string | undefined>;
  commandExists: (cmd: string) => Promise<boolean>;
  fileExists: (path: string) => Promise<boolean>;
}

async function realCommandExists(cmd: string, plat: NodeJS.Platform): Promise<boolean> {
  const which = plat === 'win32' ? 'where' : 'which';
  const proc = Bun.spawn([which, cmd], { stdout: 'ignore', stderr: 'ignore' });
  const code = await proc.exited;
  return code === 0;
}

async function realFileExists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

export async function detectWithDeps(deps: DetectDeps): Promise<DetectedTools> {
  const { platform, env, commandExists, fileExists } = deps;

  const [claude, gemini, opencode] = await Promise.all([
    commandExists('claude'),
    commandExists('gemini'),
    commandExists('opencode'),
  ]);

  let vscode = await commandExists('code');

  if (!vscode && platform === 'darwin') {
    vscode = await fileExists('/Applications/Visual Studio Code.app/Contents/MacOS/Electron');
  }

  if (!vscode && platform === 'win32') {
    const localAppData = env.LOCALAPPDATA ?? '';
    vscode = await fileExists(`${localAppData}\\Programs\\Microsoft VS Code\\Code.exe`);
  }

  return { vscode, claude, gemini, opencode };
}

export async function detectInstalledTools(): Promise<DetectedTools> {
  const plat = process.platform;
  return detectWithDeps({
    platform: plat,
    env: process.env,
    commandExists: (cmd) => realCommandExists(cmd, plat),
    fileExists: realFileExists,
  });
}
