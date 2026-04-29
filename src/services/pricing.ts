import { db } from '../db/index.js';

const LITELLM_PRICE_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

export class PricingService {
  /**
   * 从 LiteLLM 获取最新价格并同步到数据库
   */
  static async syncPrices(force = false) {
    // 检查最后更新时间，避免频繁请求
    if (!force) {
      const lastUpdate = db.query('SELECT MAX(updated_at) as last FROM model_prices').get() as { last: string };
      if (lastUpdate?.last) {
        const lastDate = new Date(lastUpdate.last + ' Z'); // 假设 UTC
        const now = new Date();
        const diffMs = now.getTime() - lastDate.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        
        if (diffHours < 24) {
          console.log(`[Pricing] 数据尚新 (上次更新于 ${diffHours.toFixed(1)}h 前)，跳过远程同步。`);
          return 0;
        }
      }
    }

    console.log('[Pricing] 正在从远程同步模型价格数据...');
    try {
      const response = await fetch(LITELLM_PRICE_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      let count = 0;

      const upsertStmt = db.prepare(`
        INSERT INTO model_prices (model_id, vendor, input_price, output_price, updated_at)
        VALUES ($model_id, $vendor, $input_price, $output_price, CURRENT_TIMESTAMP)
        ON CONFLICT(model_id) DO UPDATE SET
          vendor = excluded.vendor,
          input_price = excluded.input_price,
          output_price = excluded.output_price,
          updated_at = CURRENT_TIMESTAMP
      `);

      const transaction = db.transaction((models: any[]) => {
        for (const [modelId, info] of models) {
          const inputPrice = (info.input_cost_per_token || 0) * 1000;
          const outputPrice = (info.output_cost_per_token || info.input_cost_per_token || 0) * 1000;
          const vendor = info.litellm_provider || 'unknown';

          if (inputPrice > 0 || outputPrice > 0) {
            upsertStmt.run({
              $model_id: modelId,
              $vendor: vendor,
              $input_price: inputPrice,
              $output_price: outputPrice
            });
            count++;
          }
        }
      });

      transaction(Object.entries(data));
      console.log(`[Pricing] 价格同步完成，共更新 ${count} 条记录。`);
      return count;
    } catch (error) {
      console.error('[Pricing] 同步模型价格失败:', error);
      throw error;
    }
  }

  /**
   * 启动定时任务，每 24 小时尝试更新一次
   */
  static startAutoSync() {
    // 启动时尝试同步（内部有冷却检查）
    this.syncPrices().catch(console.error);

    // 设置 24 小时检查一次
    setInterval(() => {
      this.syncPrices().catch(console.error);
    }, 24 * 60 * 60 * 1000);
  }
}
