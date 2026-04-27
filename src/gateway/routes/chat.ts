import { dispatcher } from "../../services/dispatcher.js";
import type { ChatRequest } from "../types.js";

/**
 * 处理聊天请求路由
 */
export async function handleChatRoute(req: Request): Promise<Response> {
  try {
    const body = await req.json() as ChatRequest;

    if (!body.messages || !Array.isArray(body.messages)) {
      return Response.json({ error: "Invalid request: messages is required" }, { status: 400 });
    }

    if (!body.model) {
      return Response.json({ error: "Invalid request: model is required" }, { status: 400 });
    }

    // 调用调度器处理请求
    return await dispatcher.dispatchChat(body);

  } catch (err: any) {
    console.error("[Gateway] Chat route error:", err);
    return Response.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
