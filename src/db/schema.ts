export const INIT_TABLES = `
-- 账户管理
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alias TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  api_key TEXT NOT NULL, -- 加密存储
  base_url TEXT,
  anthropic_base_url TEXT, -- Anthropic 兼容端点，非空时走透传路径
  is_active INTEGER DEFAULT 1,
  weight INTEGER DEFAULT 1,
  notes TEXT,
  limits_cache TEXT, -- JSON string storing quota/limit data (e.g. {"remaining_tokens": ...})
  limits_cache_updated_at DATETIME, -- 配额数据更新时间
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 自定义 Provider
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- openai, anthropic, gemini, custom, custom-anthropic
  base_url TEXT
);

-- 模型别名
CREATE TABLE IF NOT EXISTS model_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alias TEXT NOT NULL UNIQUE,
  target_model TEXT NOT NULL,
  provider_id TEXT
);

-- 模型价格缓存
CREATE TABLE IF NOT EXISTS model_prices (
  model_id TEXT PRIMARY KEY,
  vendor TEXT,
  input_price REAL,
  output_price REAL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用量记录
CREATE TABLE IF NOT EXISTS usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  account_id INTEGER,
  provider_id TEXT,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  success INTEGER,
  error_message TEXT,
  is_test INTEGER DEFAULT 0
);

-- 应用设置
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- 访问密钥管理
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  allowed_models TEXT DEFAULT '*', -- JSON 数组或 '*' 表示全部
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

// 初始数据插入（内置 Provider & 常用模型别名）
export const SEED_DATA = `
INSERT OR IGNORE INTO providers (id, name, type) VALUES ('openai', 'OpenAI', 'openai');
INSERT OR IGNORE INTO providers (id, name, type) VALUES ('anthropic', 'Anthropic', 'anthropic');
INSERT OR IGNORE INTO providers (id, name, type) VALUES ('gemini', 'Google Gemini', 'gemini');
INSERT OR IGNORE INTO providers (id, name, type) VALUES ('custom-anthropic', 'Custom (Anthropic Compatible)', 'custom-anthropic');
`;
