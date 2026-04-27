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
}

export const settingsService = new SettingsService();
