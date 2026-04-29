import { db } from "../../db/index.js";
import { dispatcher } from "../../services/dispatcher.js";

/**
 * 获取所有可用模型（聚合所有活跃账户）
 */
export async function getAvailableModels() {
  try {
    const models = await dispatcher.listAllModels();
    return Response.json(models);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 获取所有模型别名
 */
export async function getModelAliases() {
  try {
    const stmt = db.query("SELECT * FROM model_aliases");
    const aliases = stmt.all();
    return Response.json(aliases);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 添加或更新模型别名
 */
export async function setModelAlias(req: Request) {
  try {
    const body = await req.json() as any;
    const { alias, target_model, provider_id } = body;

    if (!alias || !target_model) {
      return Response.json({ error: "Missing required fields: alias, target_model" }, { status: 400 });
    }

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO model_aliases (alias, target_model, provider_id)
      VALUES (?, ?, ?)
    `);
    
    stmt.run(alias, target_model, provider_id || null);

    return Response.json({ success: true, message: "Alias set successfully" });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 删除模型别名
 */
export async function deleteModelAlias(id: string) {
  try {
    const stmt = db.prepare("DELETE FROM model_aliases WHERE id = ?");
    const info = stmt.run(id);
    
    if (info.changes === 0) {
      return Response.json({ error: "Alias not found" }, { status: 404 });
    }

    return Response.json({ success: true, message: "Alias deleted successfully" });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 测试模型可用性
 */
export async function testModel(req: Request) {
  try {
    const { model, providerId } = await req.json() as any;
    if (!model) return Response.json({ error: "No model provided" }, { status: 400 });

    const startTime = Date.now();
    const response = await dispatcher.dispatchChat({
      model: model,
      messages: [{ role: "user", content: "hey" }],
      max_tokens: 1,
      stream: false,
      is_test: true
    }, providerId);

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = errorText;
      try {
        const errJson = JSON.parse(errorText);
        errorMsg = errJson.error?.message || errJson.error || errorText;
      } catch (e) {}

      return Response.json({ 
        success: false, 
        error: errorMsg,
        status: response.status,
        latency 
      });
    }

    return Response.json({ 
      success: true, 
      latency 
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * 获取模型健康检查/最后测试纪录
 */
export async function getModelsHealth() {
  try {
    const st = db.query(`
      SELECT u.provider_id, u.model, MAX(u.timestamp) as last_checked, u.success, u.latency_ms as latency, u.error_message as error, a.limits_cache
      FROM usage_logs u
      LEFT JOIN accounts a ON u.account_id = a.id
      GROUP BY u.provider_id, u.model
    `);
    const records = st.all().map((r: any) => ({
      ...r,
      limits_cache: r.limits_cache ? JSON.parse(r.limits_cache) : null
    }));
    return Response.json(records);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// ================= 后台模型拨测队列 =================

export type TestQueueState = {
  isRunning: boolean;
  total: number;
  current: number;
  models: { model: string, providerId: string }[];
};

export const testQueue: TestQueueState = {
  isRunning: false,
  total: 0,
  current: 0,
  models: []
};

/**
 * 启动或重置后台拨测死循环
 */
export async function startTestQueue(req: Request) {
  try {
    const { models } = await req.json() as any;
    if (!Array.isArray(models)) return Response.json({ error: "Invalid models array" }, { status: 400 });

    if (testQueue.isRunning) {
      return Response.json({ error: "A test queue is already running." }, { status: 409 });
    }

    testQueue.models = models;
    testQueue.total = models.length;
    testQueue.current = 0;
    testQueue.isRunning = true;

    // 不 `await`，直接进入后台执行
    processQueue();

    return Response.json({ success: true, message: "Queue started", total: models.length });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

async function processQueue() {
  for (let i = 0; i < testQueue.models.length; i++) {
    if (!testQueue.isRunning) break; // Allow manual kill later if needed
    testQueue.current = i + 1;
    const item = testQueue.models[i];
    
    try {
      // 复用底层 dispatcher
      await dispatcher.dispatchChat({
        model: item.model,
        messages: [{ role: "user", content: "hey" }],
        max_tokens: 1,
        stream: false,
        is_test: true
      }, item.providerId);
    } catch (e) {
      console.warn(`[Test Queue] Failed for ${item.model}:`, e);
    }
    
    // 安全缓冲
    await new Promise(r => setTimeout(r, 600));
  }
  
  testQueue.isRunning = false;
  testQueue.models = [];
  testQueue.current = 0;
  testQueue.total = 0;
}

export function getTestQueueStatus() {
  return Response.json({
    isRunning: testQueue.isRunning,
    total: testQueue.total,
    current: testQueue.current,
    progress: testQueue.total > 0 ? Math.round((testQueue.current / testQueue.total) * 100) : 0
  });
}

/**
 * 获取模型价格列表
 */
export async function getModelPrices() {
  try {
    const stmt = db.query("SELECT * FROM model_prices");
    const prices = stmt.all();
    return Response.json(prices);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
