import { env } from "../env.js";
import { anthropicIngress } from "../services/anthropic_ingress.js";
import { dispatcher } from "../services/dispatcher.js";
import { settingsService } from "../services/settings.js";
import { ASSETS } from "./assets.js";
import { apiAuthGuard, sendError, v1AuthGuard } from "./middleware.js";
import { Router } from "./router.js";
import {
  createAccount,
  deleteAccount,
  exportAccountUsage,
  listAccounts,
  updateAccount,
} from "./routes/accounts.js";
import { handleWebSession } from "./routes/auth.js";
import { handleChatRoute } from "./routes/chat.js";
import { getHealthStatus } from "./routes/health.js";
import {
  deleteApiKey,
  createApiKey,
  listApiKeys,
  updateApiKey,
} from "./routes/keys.js";
import {
  deleteModelAlias,
  getAvailableModels,
  getModelAliases,
  getModelsHealth,
  getTestQueueStatus,
  setModelAlias,
  startTestQueue,
  testModel,
} from "./routes/models.js";
import {
  exportConfig,
  getSettings,
  importConfig,
  purgeDatabase,
  updateSettings,
} from "./routes/settings.js";
import {
  applyClaudeSettings,
  deleteClaudeBackup,
  getClaudeSettings,
  getInstalledTools,
  listClaudeBackups,
  restoreClaudeBackup,
} from "./routes/system.js";
import {
  getUsageDetails,
  getUsageLogs,
  getUsageSummary,
} from "./routes/usage.js";

function getMimeType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js") || path.endsWith(".mjs"))
    return "application/javascript; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function serveAsset(filePath: string): Response | null {
  if (!ASSETS[filePath]) return null;
  return new Response(Buffer.from(ASSETS[filePath], "base64"), {
    headers: { "Content-Type": getMimeType(filePath) },
  });
}

function buildRouter(): Router {
  const router = new Router();

  // ── /v1/ — OpenAI & Anthropic 兼容 API（需要 gateway key 鉴权）────────────
  router.group("/v1", v1AuthGuard, (r) => {
    r.post("/chat/completions", ({ req }) => handleChatRoute(req));

    r.post("/messages", async ({ req }) => {
      const body = (await req.clone().json()) as { model?: string };
      if (body.model) {
        const { resolveProxyRoute } =
          await import("../services/proxy/router.js");
        const { executePassthrough } =
          await import("../services/proxy/passthrough.js");
        const ctx = resolveProxyRoute(body.model, "anthropic");
        if (ctx?.decision === "passthrough") {
          return executePassthrough(
            req,
            ctx.account,
            ctx.anthropicBaseUrl,
            ctx.resolvedModel,
          );
        }
      }
      return anthropicIngress.handleMessages(req);
    });

    r.get("/models", ({ req }) => {
      const isAnthropic =
        !!req.headers.get("x-api-key") ||
        !!req.headers.get("anthropic-version");
      if (isAnthropic) return anthropicIngress.handleModels();
      const models = dispatcher.listModelAliases();
      return Response.json({
        object: "list",
        data: models.map((m: any) => ({
          id: m.alias || m.id || m,
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: "llmux",
        })),
      });
    });
  });

  // ── /api/auth/ — 认证（公开，无需鉴权；预留登录注册扩展点）─────────────────
  router.post("/api/auth/web-session", ({ req }) => handleWebSession(req));
  // router.post("/api/auth/login", ...)    TODO: 登录
  // router.post("/api/auth/register", ...) TODO: 注册

  // ── /api/ — 管理接口（预留 web session 鉴权）─────────────────────────────
  router.group("/api", apiAuthGuard, (r) => {
    // API Key 管理
    r.get("/keys", () => listApiKeys());
    r.post("/keys", ({ req }) => createApiKey(req));
    r.put("/keys/:id", ({ req, params }) => updateApiKey(params.id, req));
    r.delete("/keys/:id", ({ params }) => deleteApiKey(params.id));

    // 账户管理
    r.get("/accounts", () => listAccounts());
    r.post("/accounts", ({ req }) => createAccount(req));
    r.put("/accounts/:id", ({ req, params }) => updateAccount(params.id, req));
    r.delete("/accounts/:id", ({ params }) => deleteAccount(params.id));
    r.get("/accounts/:id/export", ({ params }) =>
      exportAccountUsage(params.id),
    );

    // 模型管理
    r.get("/models/available", () => getAvailableModels());
    r.get("/models/aliases", () => getModelAliases());
    r.post("/models/aliases", ({ req }) => setModelAlias(req));
    r.delete("/models/aliases/:id", ({ params }) =>
      deleteModelAlias(params.id),
    );
    r.get("/models/health", () => getModelsHealth());
    r.get("/models/test-queue/status", () => getTestQueueStatus());
    r.post("/models/test-all", ({ req }) => startTestQueue(req));
    r.post("/models/test", ({ req }) => testModel(req));

    // 用量统计
    r.get("/usage/summary", ({ req }) => getUsageSummary(req));
    r.get("/usage/details", ({ req }) => getUsageDetails(req));
    r.get("/usage/logs", ({ req }) => getUsageLogs(req));

    // 系统
    r.get("/health", () => getHealthStatus());
    r.get("/system/tools", () => getInstalledTools());
    r.get("/system/claude-settings", () => getClaudeSettings());
    r.post("/system/claude-settings", ({ req }) => applyClaudeSettings(req));
    r.get("/system/claude-backups", ({ req }) => listClaudeBackups(req));
    r.post("/system/claude-backups", ({ req }) => restoreClaudeBackup(req));
    r.delete("/system/claude-backups", ({ req }) => deleteClaudeBackup(req));

    // 设置
    r.get("/settings", () => getSettings());
    r.put("/settings", ({ req }) => updateSettings(req));
    r.post("/settings/reset", () => purgeDatabase());
    r.get("/export", () => exportConfig());
    r.post("/import", ({ req }) => importConfig(req));
  });

  return router;
}

export function startGateway() {
  const settings = settingsService.getAll();
  const effectivePort = settings.port ? parseInt(settings.port) : env.PORT;
  const router = buildRouter();

  const server = Bun.serve({
    port: effectivePort,
    idleTimeout: 255,
    async fetch(req) {
      const url = new URL(req.url);

      // 路径规范化（兼容 /v1/v1/ 双前缀）
      const normalized = req.url.replace(/\/v1\/v1\//, "/v1/");
      const normalizedReq =
        normalized !== req.url ? new Request(normalized, req) : req;

      // 路由匹配
      const response = await router.handle(normalizedReq);
      if (response) return response;

      // 静态文件托管
      let filePath = url.pathname;
      if (filePath === "/" || filePath === "/ui" || filePath === "/ui/")
        filePath = "/index.html";
      if (filePath.startsWith("/ui/")) filePath = filePath.substring(3);

      const asset = serveAsset(filePath);
      if (asset) return asset;

      // SPA 回退
      if (
        !url.pathname.startsWith("/v1/") &&
        !url.pathname.startsWith("/api/")
      ) {
        const spa = serveAsset("/index.html");
        if (spa) return spa;
      }

      return sendError(req, "Not Found", "not_found", 404);
    },
    error(error) {
      console.error(error);
      return new Response("Internal Server Error", { status: 500 });
    },
  });

  console.log(`[Gateway] Server running at http://localhost:${server.port}`);
  return server;
}
