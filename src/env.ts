import { safeEnv, s } from "@zh-moody/safe-env";
import { join } from "node:path";
import { homedir } from "node:os";

// 默认数据目录：Windows 为 %APPDATA%\llmux，其他为 ~/.config/llmux
const defaultDataDir = process.platform === "win32"
  ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "llmux")
  : join(homedir(), ".config", "llmux");

const schema = {
  PORT: s.number(25975).description("Gateway 服务端口"),
  LOG_LEVEL: s.string("info").description("日志级别 (debug, info, warn, error)"),
  DATA_DIR: s.string(defaultDataDir).description("本地数据存储目录"),
  MASTER_KEY: s.string("").secret().description("用于加密 API Key 的主密钥，不建议手动修改"),
};

export const env = safeEnv(schema);

// 衍生配置
export const DATABASE_PATH = join(env.DATA_DIR, "db.sqlite");
