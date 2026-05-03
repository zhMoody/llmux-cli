import type { Account } from "../../gateway/types.js";
import { usageService } from "../usage.js";
import type { AnthropicAuthHeader } from "./types.js";

/**
 * 执行 the provider 协议透传。
 * 仅在 router 决策为 "passthrough" 时调用。
 */
export async function executePassthrough(
  originalReq: Request,
  account: Account,
  providerBaseUrl: string,
  resolvedModel: string,
): Promise<Response> {
  const startedAt = Date.now();
  try {
    const targetUrl = buildTargetUrl(providerBaseUrl);
    console.log(`[Proxy] ⚡ → ${targetUrl} (model="${resolvedModel}")`);
    return await doFetch(
      originalReq,
      account,
      targetUrl,
      resolvedModel,
      startedAt,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Passthrough error";
    console.error("[Proxy] passthrough failed:", message);
    usageService.logUsage({
      accountId: account.id,
      providerId: account.provider_id,
      model: resolvedModel,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startedAt,
      success: false,
      errorMessage: message,
    });
    return Response.json(
      { type: "error", error: { type: "proxy_error", message } },
      { status: 502 },
    );
  }
}

/**
 * 目标 URL：
 * 若 providerBaseUrl 末尾不含 /v1，自动补上（适配 DeepSeek、GLM 等把协议前缀当 base 的端点）。
 */
function buildTargetUrl(providerBaseUrl: string): string {
  const base = providerBaseUrl.replace(/\/+$/, "");
  const prefix = base.endsWith("/v1") ? "" : "/v1";
  return `${base}${prefix}/messages`;
}

/**
 * 剥离客户端原始 headers，注入新鉴权头，替换 model 字段，转发请求。
 * 流式响应通过 TransformStream 边透传边解析 SSE 事件统计 token，不影响体验。
 */
async function doFetch(
  originalReq: Request,
  account: Account,
  targetUrl: string,
  resolvedModel: string,
  startedAt: number,
): Promise<Response> {
  // 1. 替换 body 中的 model 字段
  const originalBody = (await originalReq.json()) as Record<string, unknown>;
  const patchedBody: Record<string, unknown> = {
    ...originalBody,
    model: resolvedModel,
  };

  // 2. 构建干净的请求头
  const authHeader: AnthropicAuthHeader = {
    type: "anthropic",
    "x-api-key": account.api_key,
    "anthropic-version": "2023-06-01",
  };

  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("x-api-key", authHeader["x-api-key"]);
  headers.set("provider-version", authHeader["anthropic-version"]);

  const beta = originalReq.headers.get("provider-beta");
  if (beta) headers.set("provider-beta", beta);

  // 3. 发请求
  const upstreamRes = await fetch(targetUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(patchedBody),
  });

  // 4. 构建响应头
  const responseHeaders = new Headers();
  const contentType = upstreamRes.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);
  const isStream = contentType?.includes("text/event-stream") ?? false;
  if (isStream) {
    responseHeaders.set("cache-control", "no-cache");
    responseHeaders.set("connection", "keep-alive");
  }

  // 上游错误：原样透传 + 记录失败
  if (!upstreamRes.ok) {
    const errorText = await upstreamRes
      .clone()
      .text()
      .catch(() => "");
    usageService.logUsage({
      accountId: account.id,
      providerId: account.provider_id,
      model: resolvedModel,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startedAt,
      success: false,
      errorMessage: `HTTP ${upstreamRes.status}: ${errorText.slice(0, 200)}`,
    });
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  }

  // 5. 成功响应：流式 vs 非流式分别处理
  if (isStream) {
    return wrapStreamWithUsage(
      upstreamRes,
      responseHeaders,
      account,
      resolvedModel,
      startedAt,
    );
  }
  return wrapJsonWithUsage(
    upstreamRes,
    responseHeaders,
    account,
    resolvedModel,
    startedAt,
  );
}

/**
 * 非流式：clone 后异步解析 usage，原响应直接返回客户端。
 */
function wrapJsonWithUsage(
  upstreamRes: Response,
  responseHeaders: Headers,
  account: Account,
  resolvedModel: string,
  startedAt: number,
): Response {
  upstreamRes
    .clone()
    .json()
    .then((data: any) => {
      const inputTokens = data?.usage?.input_tokens ?? 0;
      const outputTokens = data?.usage?.output_tokens ?? 0;
      console.log(`[Proxy][Usage][JSON] account=${account.id} model=${resolvedModel} input=${inputTokens} output=${outputTokens}`);
      usageService.logUsage({
        accountId: account.id,
        providerId: account.provider_id,
        model: resolvedModel,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startedAt,
        success: true,
      });
    })
    .catch(() => {});

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}

/**
 * 流式：用 TransformStream 边透传边解析 SSE 事件，
 * 累积 input_tokens / output_tokens，stream 结束时记录。
 */
function wrapStreamWithUsage(
  upstreamRes: Response,
  responseHeaders: Headers,
  account: Account,
  resolvedModel: string,
  startedAt: number,
): Response {
  let inputTokens = 0;
  let outputTokens = 0;
  let buffer = "";
  const decoder = new TextDecoder();

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      // 原样透传字节
      controller.enqueue(chunk);

      // 同时按行解析 SSE，累积 usage
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "message_start" && evt.message?.usage) {
            inputTokens = evt.message.usage.input_tokens ?? inputTokens;
            outputTokens = evt.message.usage.output_tokens ?? outputTokens;
            console.log(`[Proxy][Usage][SSE message_start] input=${inputTokens} output=${outputTokens}`);
          } else if (evt.type === "message_delta" && evt.usage) {
            outputTokens = evt.usage.output_tokens ?? outputTokens;
          }
        } catch {}
      }
    },
    flush() {
      console.log(`[Proxy][Usage][SSE flush] account=${account.id} model=${resolvedModel} input=${inputTokens} output=${outputTokens}`);
      usageService.logUsage({
        accountId: account.id,
        providerId: account.provider_id,
        model: resolvedModel,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startedAt,
        success: true,
      });
    },
  });

  return new Response(upstreamRes.body!.pipeThrough(transform), {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}
