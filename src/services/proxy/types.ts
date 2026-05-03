import type { Account } from "../../gateway/types.js";

/** 客户端发来的协议类型 */
export type ClientProtocol = "anthropic" | "openai";

/** 路由决策：透传 or 回退旧路径 */
export type RouteDecision = "passthrough" | "fallback";

/** router 解析后传给下游的完整上下文 */
export interface ProxyRouteContext {
  decision: RouteDecision;
  /** alias 已替换为真实模型名 */
  resolvedModel: string;
  account: Account;
  /** 透传时使用的 Anthropic 兼容端点 URL */
  anthropicBaseUrl: string;
}

/** Anthropic 上游鉴权头 */
export interface AnthropicAuthHeader {
  type: "anthropic";
  "x-api-key": string;
  "anthropic-version": string;
}

export type PassthroughIndices = Map<string, number>;
