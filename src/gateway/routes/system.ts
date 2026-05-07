import { detectInstalledTools } from "../../services/detect-tools.js";
import { env } from "../../env.js";
import { join } from "path";
import { homedir } from "os";
import { readdirSync, statSync, unlinkSync, mkdirSync } from "fs";

const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const CLAUDE_BACKUPS_DIR = join(env.DATA_DIR, "claude-backups");

export async function getInstalledTools() {
  try {
    const tools = await detectInstalledTools();
    return Response.json(tools);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function getClaudeSettings() {
  try {
    const file = Bun.file(CLAUDE_SETTINGS_PATH);
    const exists = await file.exists();
    if (!exists) return Response.json({ exists: false, settings: null });
    const settings = await file.json();
    return Response.json({ exists: true, settings });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function applyClaudeSettings(req: Request) {
  try {
    const body = await req.json() as {
      apiBaseUrl: string;
      apiKey: string;
      opusModel?: string;
      sonnetModel?: string;
      haikuModel?: string;
    };

    const file = Bun.file(CLAUDE_SETTINGS_PATH);
    const existing = await file.exists() ? await file.json() : {};

    // 确保备份目录存在
    mkdirSync(CLAUDE_BACKUPS_DIR, { recursive: true });

    // 备份
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupPath = join(CLAUDE_BACKUPS_DIR, `settings.json.${timestamp}`);
    if (await file.exists()) {
      await Bun.write(backupPath, JSON.stringify(existing, null, 2));
    }

    // 统一使用 ANTHROPIC_API_KEY，移除旧的 ANTHROPIC_AUTH_TOKEN
    const baseEnv = { ...(existing.env ?? {}) };
    delete baseEnv.ANTHROPIC_AUTH_TOKEN;

    const newEnv: Record<string, string> = {
      ...baseEnv,
      ANTHROPIC_BASE_URL: body.apiBaseUrl,
      ANTHROPIC_API_KEY: body.apiKey,
    };

    // 有值则设置，没有值则从 env 里删掉（清理本地残留）
    if (body.opusModel)   newEnv.ANTHROPIC_DEFAULT_OPUS_MODEL   = body.opusModel;
    else                  delete newEnv.ANTHROPIC_DEFAULT_OPUS_MODEL;

    if (body.sonnetModel) newEnv.ANTHROPIC_DEFAULT_SONNET_MODEL = body.sonnetModel;
    else                  delete newEnv.ANTHROPIC_DEFAULT_SONNET_MODEL;

    if (body.haikuModel)  newEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL  = body.haikuModel;
    else                  delete newEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL;

    const merged = { ...existing, env: newEnv };
    await Bun.write(CLAUDE_SETTINGS_PATH, JSON.stringify(merged, null, 2));

    // 只保留最近 3 条备份，超出的删除最旧的
    try {
      const allBackups = readdirSync(CLAUDE_BACKUPS_DIR)
        .filter(f => f.startsWith("settings.json."))
        .sort((a, b) => b.localeCompare(a)); // 最新在前
      for (const old of allBackups.slice(3)) {
        unlinkSync(join(CLAUDE_BACKUPS_DIR, old));
      }
    } catch { /* 目录不存在则跳过 */ }

    return Response.json({
      success: true,
      backupPath: await file.exists() ? backupPath : null,
      settings: merged,
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function listClaudeBackups(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get('name');

  // GET ?name=xxx → 读取单个备份内容
  if (name) {
    try {
      if (!name.startsWith('settings.json.') || name.includes('/') || name.includes('..')) {
        return Response.json({ error: 'Invalid backup name' }, { status: 400 });
      }
      const file = Bun.file(join(CLAUDE_BACKUPS_DIR, name));
      if (!await file.exists()) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ settings: await file.json() });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // GET → 列出所有备份
  try {
    let files: { name: string; path: string; timestamp: string; size: number }[] = [];
    try {
      const entries = readdirSync(CLAUDE_BACKUPS_DIR);
      files = entries
        .filter(f => f.startsWith("settings.json."))
        .map(f => {
          const fullPath = join(CLAUDE_BACKUPS_DIR, f);
          const stat = statSync(fullPath);
          // settings.json.2026-05-07T10-30-00 → "2026-05-07 10:30:00"
          const ts = f.replace("settings.json.", "").replace("T", " ").replace(/-(\d{2})-(\d{2})$/, ":$1:$2");
          return { name: f, path: fullPath, timestamp: ts, size: stat.size };
        })
        .sort((a, b) => b.name.localeCompare(a.name));
    } catch {
      // backups 目录不存在则返回空列表
    }
    return Response.json(files);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function restoreClaudeBackup(req: Request) {
  try {
    const { name } = await req.json() as { name: string };

    // 安全校验：只允许还原 settings.json.* 格式，不允许路径穿越
    if (!name.startsWith("settings.json.") || name.includes("/") || name.includes("..")) {
      return Response.json({ error: "Invalid backup name" }, { status: 400 });
    }

    const backupFile = Bun.file(join(CLAUDE_BACKUPS_DIR, name));
    if (!await backupFile.exists()) {
      return Response.json({ error: "Backup file not found" }, { status: 404 });
    }

    const backupContent = await backupFile.json();
    await Bun.write(CLAUDE_SETTINGS_PATH, JSON.stringify(backupContent, null, 2));
    return Response.json({ success: true, settings: backupContent });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function deleteClaudeBackup(req: Request) {
  try {
    const { name } = await req.json() as { name: string };
    if (!name.startsWith("settings.json.") || name.includes("/") || name.includes("..")) {
      return Response.json({ error: "Invalid backup name" }, { status: 400 });
    }
    const path = join(CLAUDE_BACKUPS_DIR, name);
    if (!Bun.file(path).exists()) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    unlinkSync(path);
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
