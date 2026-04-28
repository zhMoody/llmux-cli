import { join } from "node:path";
import { env } from "../env.js";
import { dispatcher } from "../services/dispatcher.js";
import { createAccount, deleteAccount, listAccounts, updateAccount } from "./routes/accounts.js";
import { handleWebSession } from "./routes/auth.js";
import { handleChatRoute } from "./routes/chat.js";
import { getHealthStatus } from "./routes/health.js";
import { checkAuth, createApiKey, deleteApiKey, listApiKeys } from "./routes/keys.js";
import { deleteModelAlias, getAvailableModels, getModelAliases, setModelAlias } from "./routes/models.js";
import { getSettings, purgeDatabase, updateSettings } from "./routes/settings.js";
import { getUsageDetails, getUsageSummary } from "./routes/usage.js";

/**
 * 启动 HTTP Gateway
 */
export function startGateway() {
  const server = Bun.serve({
    port: env.PORT,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname.includes("/export") && url.pathname.startsWith("/api/accounts/")) {
        const id = url.pathname.split("/").filter(Boolean)[2];
        if (id && req.method === "GET") {
          const { exportAccountUsage } = await import("./routes/accounts.js");
          return exportAccountUsage(id);
        }
      }

      // 1. 鉴权逻辑
      // 仅拦截外部 API 路径 (/v1/)，管理接口(/api/)和静态文件放行
      if (url.pathname.startsWith("/v1/")) {
        let requestedModel: string | undefined;
        if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
          try {
            const body = await req.clone().json() as any;
            requestedModel = body.model;
          } catch (e) {}
        }

        const auth = checkAuth(req, requestedModel);
        if (!auth.authorized) {
          return Response.json({ error: "Unauthorized", message: auth.error }, { status: 401 });
        }
      }

      // 2. API 路由分发
      if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
        return handleChatRoute(req);
      }

      if (req.method === "GET" && url.pathname === "/v1/models") {
        const models = dispatcher.listModelAliases();
        return Response.json({ data: models });
      }

      // 1.1 管理 API (Web UI 调用)
      // API Key 管理
      if (url.pathname === "/api/keys") {
        if (req.method === "GET") return listApiKeys();
        if (req.method === "POST") return createApiKey(req);
      }
      if (url.pathname.startsWith("/api/keys/")) {
        const id = url.pathname.split("/").pop();
        if (id && req.method === "DELETE") return deleteApiKey(id);
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

      if (url.pathname === "/api/models/test-queue/status" && req.method === "GET") {
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
        return getUsageSummary();
      }
      if (url.pathname === "/api/usage/details" && req.method === "GET") {
        return getUsageDetails();
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

      // 2. 静态文件托管 (Web UI)
      const publicDir = join(import.meta.dir, "../ui/dist");
      let filePath = url.pathname;
      
      // 路由重定向：/ 或 /ui 映射到 index.html
      if (filePath === "/" || filePath === "/ui" || filePath === "/ui/") {
        filePath = "/index.html";
      }

      // 如果路径以 /ui/ 开头，剥离前缀
      if (filePath.startsWith("/ui/")) {
        filePath = filePath.substring(3);
      }

      const file = Bun.file(join(publicDir, filePath));
      if (await file.exists()) {
        return new Response(file);
      }

      // 默认响应 (SPA 回退)
      if (!url.pathname.startsWith("/v1/")) {
        const indexFile = Bun.file(join(publicDir, "index.html"));
        if (await indexFile.exists()) {
          return new Response(indexFile);
        }
      }

      return new Response("LLMux Gateway v0.1.0 (Static files not found)", { status: 404 });
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
