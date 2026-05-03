import { dispatcher } from "../dispatcher.js";
import type { Account } from "../../gateway/types.js";
import type {
  ClientProtocol,
  ProxyRouteContext,
  PassthroughIndices,
} from "./types.js";

/** 透传路径专用 round-robin 索引，与 dispatcher 内部状态隔离 */
const passthroughIndices: PassthroughIndices = new Map();

/**
 * 解析请求，决定走透传还是回退旧路径。
 * 返回 null 表示无可用账户，调用方应 fallthrough 到旧路径。
 */
export function resolveProxyRoute(
  modelAlias: string,
  clientProtocol: ClientProtocol,
): ProxyRouteContext | null {
  const { providerId, targetModel } = dispatcher.resolveModel(modelAlias);
  const accounts = dispatcher.getAccounts(providerId);
  if (accounts.length === 0) return null;

  const account = pickAccount(providerId, accounts);

  // 核心判断：客户端 Anthropic + 账户有 anthropic_base_url → 透传
  if (clientProtocol === "anthropic" && account.anthropic_base_url) {
    console.log(
      `[Proxy] ⚡ passthrough | model="${modelAlias}"→"${targetModel}"` +
      ` | account="${account.alias}" → ${account.anthropic_base_url}`
    );
    return {
      decision: "passthrough",
      resolvedModel: targetModel,
      account,
      anthropicBaseUrl: account.anthropic_base_url,
    };
  }

  console.log(
    `[Proxy] 🔄 fallback→legacy | client=${clientProtocol}` +
    ` | model="${modelAlias}" | account="${account.alias}"`
  );
  return {
    decision: "fallback",
    resolvedModel: targetModel,
    account,
    anthropicBaseUrl: "",
  };
}

/** 透传路径独立 round-robin */
function pickAccount(providerId: string, accounts: Account[]): Account {
  const idx = passthroughIndices.get(providerId) ?? 0;
  passthroughIndices.set(providerId, (idx + 1) % accounts.length);
  return accounts[idx % accounts.length];
}
