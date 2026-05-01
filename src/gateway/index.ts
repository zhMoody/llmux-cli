import { env } from "../env.js";
import { anthropicIngress } from "../services/anthropic_ingress.js";
import { dispatcher } from "../services/dispatcher.js";
import { settingsService } from "../services/settings.js";
import { ASSETS } from "./assets.js";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount,
} from "./routes/accounts.js";
import { handleWebSession } from "./routes/auth.js";
import { handleChatRoute } from "./routes/chat.js";
import { getHealthStatus } from "./routes/health.js";
import {
  checkAuthBasic,
  checkAuthModel,
  createApiKey,
  deleteApiKey,
  listApiKeys,
  updateApiKey,
} from "./routes/keys.js";
import {
  deleteModelAlias,
  getAvailableModels,
  getModelAliases,
  setModelAlias,
} from "./routes/models.js";
import {
  getSettings,
  purgeDatabase,
  updateSettings,
} from "./routes/settings.js";
import { getUsageDetails, getUsageSummary } from "./routes/usage.js";

/**
 * 启动 HTTP Gateway
 */
export function startGateway() {
  // 启动模型价格自动同步任务

  const settings = settingsService.getAll();
  const effectivePort = settings.port ? parseInt(settings.port) : env.PORT;

  const server = Bun.serve({
    port: effectivePort,
    idleTimeout: 255, // 设为 Bun 允许的最大值 (255s)，适配 Claude Code 等长耗时任务
    async fetch(req) {
      const url = new URL(req.url);

      // 通用错误响应适配器
      const sendError = (
        message: string,
        type: string = "invalid_request_error",
        status: number = 400,
      ) => {
        const isAnthropic = !!req.headers.get("x-api-key");
        if (isAnthropic) {
          return Response.json(
            {
              type: "error",
              error: {
                type: status === 401 ? "authentication_error" : type,
                message: message,
              },
            },
            { status },
          );
        }
        return Response.json(
          {
            error: {
              message: message,
              type: type,
              code: status.toString(),
            },
          },
          { status },
        );
      };

      if (
        url.pathname.includes("/export") &&
        url.pathname.startsWith("/api/accounts/")
      ) {
        const id = url.pathname.split("/").filter(Boolean)[2];
        if (id && req.method === "GET") {
          const { exportAccountUsage } = await import("./routes/accounts.js");
          return exportAccountUsage(id);
        }
      }

      // 1. 鉴权逻辑
      // 仅拦截外部 API 路径 (/v1/)，管理接口(/api/)和静态文件放行
      const normalizedPath = url.pathname.replace(/^\/v1\/v1\//, "/v1/");

      if (normalizedPath.startsWith("/v1/")) {
        // 先验证 Key 是否有效，不读 body
        const basicAuth = checkAuthBasic(req);
        if (!basicAuth.authorized) {
          return sendError(basicAuth.error || "Unauthorized", "authentication_error", 401);
        }

        // 需要模型权限校验的路由，鉴权通过后再解析 body
        if (
          (normalizedPath === "/v1/chat/completions" || normalizedPath === "/v1/messages") &&
          req.method === "POST"
        ) {
          try {
            const body = (await req.clone().json()) as any;
            const requestedModel = body.model;
            if (requestedModel) {
              const modelAuth = checkAuthModel(basicAuth.keyRecord, requestedModel);
              if (!modelAuth.authorized) {
                return sendError(modelAuth.error || "Unauthorized", "authentication_error", 401);
              }
            }
          } catch (e) {}
        }
      }

      // 2. API 路由分发
      if (req.method === "POST" && normalizedPath === "/v1/chat/completions") {
        return handleChatRoute(req);
      }

      if (req.method === "POST" && normalizedPath === "/v1/messages") {
        return anthropicIngress.handleMessages(req);
      }

      if (req.method === "GET" && normalizedPath === "/v1/models") {
        const isAnthropic =
          !!req.headers.get("x-api-key") ||
          !!req.headers.get("anthropic-version");

        if (isAnthropic) {
          return anthropicIngress.handleModels();
        }
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
      }

      // 1.1 管理 API (Web UI 调用)
      // API Key 管理
      if (url.pathname === "/api/keys") {
        if (req.method === "GET") return listApiKeys();
        if (req.method === "POST") return createApiKey(req);
      }
      if (url.pathname.startsWith("/api/keys/")) {
        const id = url.pathname.split("/").pop();
        if (id) {
          if (req.method === "DELETE") return deleteApiKey(id);
          if (req.method === "PUT") return updateApiKey(id, req);
        }
      }
      // 身份认证与 Session 导入
      if (url.pathname === "/api/auth/web-session" && req.method === "POST") {
        return handleWebSession(req);
      }

      // 账户管理
      if (url.pathname === "/api/accounts") {
        if (req.method === "GET") return listAccounts();
        if (req.method === "POST") return createAccount(req);
      }

      // 账户管理子路由：更新、删除
      if (url.pathname.startsWith("/api/accounts/")) {
        const pathParts = url.pathname.split("/").filter(Boolean);
        const id = pathParts[2];

        if (id) {
          if (req.method === "PUT") return updateAccount(id, req);
          if (req.method === "DELETE") return deleteAccount(id);
        }
      }

      // 模型管理
      if (url.pathname === "/api/models/available" && req.method === "GET") {
        return getAvailableModels();
      }

      if (url.pathname === "/api/models/aliases") {
        if (req.method === "GET") return getModelAliases();
        if (req.method === "POST") return setModelAlias(req);
      }

      if (url.pathname === "/api/models/health" && req.method === "GET") {
        const { getModelsHealth } = await import("./routes/models.js");
        return getModelsHealth();
      }

      if (
        url.pathname === "/api/models/test-queue/status" &&
        req.method === "GET"
      ) {
        const { getTestQueueStatus } = await import("./routes/models.js");
        return getTestQueueStatus();
      }

      if (url.pathname === "/api/models/test-all" && req.method === "POST") {
        const { startTestQueue } = await import("./routes/models.js");
        return startTestQueue(req);
      }

      if (url.pathname.startsWith("/api/models/aliases/")) {
        const id = url.pathname.split("/").pop();
        if (id && req.method === "DELETE") return deleteModelAlias(id);
      }

      if (url.pathname === "/api/models/test" && req.method === "POST") {
        const { testModel } = await import("./routes/models.js");
        return testModel(req);
      }

      // 用量统计
      if (url.pathname === "/api/usage/summary" && req.method === "GET") {
        return getUsageSummary(req);
      }
      if (url.pathname === "/api/usage/details" && req.method === "GET") {
        return getUsageDetails(req);
      }
      if (url.pathname === "/api/usage/logs" && req.method === "GET") {
        const { getUsageLogs } = await import("./routes/usage.js");
        return getUsageLogs(req);
      }

      // 健康状态
      if (url.pathname === "/api/health" && req.method === "GET") {
        return getHealthStatus();
      }

      // 系统设置
      if (url.pathname === "/api/settings") {
        if (req.method === "GET") return getSettings();
        if (req.method === "PUT") return updateSettings(req);
      }
      if (url.pathname === "/api/settings/reset" && req.method === "POST") {
        return purgeDatabase();
      }

      // 2. 静态文件托管 (Web UI，全量内嵌)
      let filePath = url.pathname;

      // 路由重定向：/ 或 /ui 映射到 index.html
      if (filePath === "/" || filePath === "/ui" || filePath === "/ui/") {
        filePath = "/index.html";
      }

      // 如果路径以 /ui/ 开头，剥离前缀
      if (filePath.startsWith("/ui/")) {
        filePath = filePath.substring(3);
      }

      const getMimeType = (path: string) => {
        if (path.endsWith(".html")) return "text/html; charset=utf-8";
        if (path.endsWith(".css")) return "text/css; charset=utf-8";
        if (path.endsWith(".js") || path.endsWith(".mjs"))
          return "application/javascript; charset=utf-8";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".json")) return "application/json; charset=utf-8";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg"))
          return "image/jpeg";
        return "application/octet-stream";
      };

      if (ASSETS[filePath]) {
        const buffer = Buffer.from(ASSETS[filePath], "base64");
        return new Response(buffer, {
          headers: { "Content-Type": getMimeType(filePath) },
        });
      }

      // SPA 回退
      if (
        !url.pathname.startsWith("/v1/") &&
        !url.pathname.startsWith("/api/")
      ) {
        if (ASSETS["/index.html"]) {
          return new Response(Buffer.from(ASSETS["/index.html"], "base64"), {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
      }

      return new Response("LLMux Gateway v0.1.0 (Static files not found)", {
        status: 404,
      });
    },
    error(error) {
      return new Response(`<pre>${error}\n${error.stack}</pre>`, {
        headers: { "Content-Type": "text/html" },
      });
    },
  });

  console.log(`[Gateway] Server running at http://localhost:${server.port}`);
  return server;
}
