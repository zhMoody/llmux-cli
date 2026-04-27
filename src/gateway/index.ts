import { join } from "node:path";
import { env } from "../env.js";
import { handleChatRoute } from "./routes/chat.js";
import { dispatcher } from "../services/dispatcher.js";
import { listAccounts, createAccount, updateAccount, deleteAccount } from "./routes/accounts.js";
import { getAvailableModels, getModelAliases, setModelAlias, deleteModelAlias } from "./routes/models.js";
import { handleWebSession } from "./routes/auth.js";
import { getUsageSummary, getUsageDetails } from "./routes/usage.js";
import { getSettings, updateSettings } from "./routes/settings.js";
import { getHealthStatus } from "./routes/health.js";

/**
 * 启动 HTTP Gateway
 */
export function startGateway() {
  const server = Bun.serve({
    port: env.PORT,
    async fetch(req) {
      const url = new URL(req.url);

      // 1. API 路由分发
      if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
        return handleChatRoute(req);
      }

      if (req.method === "GET" && url.pathname === "/v1/models") {
        const models = await dispatcher.listAllModels();
        return Response.json({ data: models });
      }

      // 1.1 管理 API (Web UI 调用)
      // 身份认证与 Session 导入
      if (url.pathname === "/api/auth/web-session" && req.method === "POST") {
        return handleWebSession(req);
      }

      // 账户管理
      if (url.pathname === "/api/accounts") {
        if (req.method === "GET") return listAccounts();
        if (req.method === "POST") return createAccount(req);
      }

      if (url.pathname.startsWith("/api/accounts/")) {
        const id = url.pathname.split("/").pop();
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

      if (url.pathname.startsWith("/api/models/aliases/")) {
        const id = url.pathname.split("/").pop();
        if (id && req.method === "DELETE") return deleteModelAlias(id);
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
