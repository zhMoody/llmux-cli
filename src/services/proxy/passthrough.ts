import type { Account } from "../../gateway/types.js";
import type { AnthropicAuthHeader } from "./types.js";

/**
 * 执行 Anthropic 协议透传。
 * 仅在 router 决策为 "passthrough" 时调用。
 */
export async function executePassthrough(
  originalReq: Request,
  account: Account,
  anthropicBaseUrl: string,
  resolvedModel: string,
): Promise<Response> {
  try {
    const targetUrl = buildTargetUrl(anthropicBaseUrl);
    console.log(`[Proxy] ⚡ → ${targetUrl} (model="${resolvedModel}")`);
    return await doFetch(originalReq, account, targetUrl, resolvedModel);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Passthrough error";
    console.error("[Proxy] passthrough failed:", message);
    return Response.json(
      { type: "error", error: { type: "proxy_error", message } },
      { status: 502 },
    );
  }
}

/**
 * 目标 URL：
 * 若 anthropicBaseUrl 末尾不含 /v1，自动补上（适配 DeepSeek、GLM 等把协议前缀当 base 的端点）。
 */
function buildTargetUrl(anthropicBaseUrl: string): string {
  const base = anthropicBaseUrl.replace(/\/+$/, "");
  const prefix = base.endsWith("/v1") ? "" : "/v1";
  return `${base}${prefix}/messages`;
}

/**
 * 剥离客户端原始 headers，注入新鉴权头，替换 model 字段，转发请求。
 * 响应体（流式/非流式）直接透传 ReadableStream，无需 TransformStream。
 */
async function doFetch(
  originalReq: Request,
  account: Account,
  targetUrl: string,
  resolvedModel: string,
): Promise<Response> {
  // 1. 替换 body 中的 model 字段
  const originalBody = await originalReq.json() as Record<string, unknown>;
  const patchedBody: Record<string, unknown> = { ...originalBody, model: resolvedModel };

  // 2. 构建干净的请求头
  const authHeader: AnthropicAuthHeader = {
    type: "anthropic",
    "x-api-key": account.api_key,
    "anthropic-version": "2023-06-01",
  };

  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("x-api-key", authHeader["x-api-key"]);
  headers.set("anthropic-version", authHeader["anthropic-version"]);

  // 透传 anthropic-beta（支持 extended thinking 等扩展特性）
  const beta = originalReq.headers.get("anthropic-beta");
  if (beta) headers.set("anthropic-beta", beta);

  // 3. 发请求
  const upstreamRes = await fetch(targetUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(patchedBody),
  });

  // 4. 构建响应头，只透传必要部分
  const responseHeaders = new Headers();
  const contentType = upstreamRes.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);
  if (contentType?.includes("text/event-stream")) {
    responseHeaders.set("cache-control", "no-cache");
    responseHeaders.set("connection", "keep-alive");
  }

  // 5. 直接透传 ReadableStream
  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}
