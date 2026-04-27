import { db } from "../db/index.js";

export class SettingsService {
  /**
   * 获取所有设置
   */
  getAll() {
    const rows = db.query("SELECT * FROM settings").all() as { key: string; value: string }[];
    const result: Record<string, any> = {};
    rows.forEach(row => {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    });
    return result;
  }

  /**
   * 保存设置
   */
  set(key: string, value: any) {
    const valStr = typeof value === 'string' ? value : JSON.stringify(value);
    db.run(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      [key, valStr]
    );
  }

  /**
   * 批量保存
   */
  batchSet(settings: Record<string, any>) {
    const transaction = db.transaction((data: Record<string, any>) => {
      for (const [key, value] of Object.entries(data)) {
        this.set(key, value);
      }
    });
    transaction(settings);
  }

  /**
   * 获取或创建网关安全密钥
   */
  getOrCreateGatewayKey(): string {
    const settings = this.getAll();
    if (settings.gateway_key) return settings.gateway_key;

    // 生成随机 32 位密钥
    const newKey = `sk-llmux-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    this.set("gateway_key", newKey);
    return newKey;
  }
}

export const settingsService = new SettingsService();
