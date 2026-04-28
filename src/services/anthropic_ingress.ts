import { dispatcher } from "./dispatcher.js";
import type { ChatRequest, ChatMessage } from "../gateway/types.js";

/**
 * Anthropic 入口处理器 (Anthropic Ingress)
 * 允许客户端使用 Anthropic 协议调用 LLMux
 */
export class AnthropicIngressService {
  async handleMessages(req: Request): Promise<Response> {
    try {
      const anthropicReq = await req.json() as any;

      // 1. Anthropic 请求 -> OpenAI 内部格式
      const openAIRequest: ChatRequest = {
        model: anthropicReq.model,
        messages: this.transformToOpenAIMessages(anthropicReq.system, anthropicReq.messages),
        max_tokens: anthropicReq.max_tokens,
        temperature: anthropicReq.temperature,
        top_p: anthropicReq.top_p,
        stream: anthropicReq.stream,
        stop: anthropicReq.stop_sequences,
      };

      // 2. 调用调度器
      const response = await dispatcher.dispatchChat(openAIRequest);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return Response.json({
          type: "error",
          error: {
            type: response.status === 401 ? "authentication_error" : "api_error",
            message: errorData.error?.message || errorData.error || "Provider Error"
          }
        }, { status: response.status });
      }

      // 3. 将响应转换回 Anthropic 格式
      if (openAIRequest.stream) {
        return this.handleStreamResponse(response, openAIRequest.model);
      } else {
        return this.handleNormalResponse(response, openAIRequest.model);
      }
    } catch (err: any) {
      return Response.json({
        type: "error",
        error: {
          type: "invalid_request_error",
          message: err.message
        }
      }, { status: 400 });
    }
  }

  async handleModels(): Promise<Response> {
    const models = dispatcher.listModelAliases();
    const anthropicModels = models.map((m: any) => ({
      type: "model",
      id: m.alias || m.id,
      display_name: m.alias || m.id,
      created_at: new Date().toISOString(),
    }));

    return Response.json({
      data: anthropicModels,
      has_more: false,
      first_id: anthropicModels[0]?.id || null,
      last_id: anthropicModels[anthropicModels.length - 1]?.id || null,
    });
  }

  private transformToOpenAIMessages(system: string, messages: any[]): ChatMessage[] {
    const result: ChatMessage[] = [];
    if (system) {
      result.push({ role: "system", content: system });
    }
    for (const msg of messages) {
      result.push({
        role: msg.role,
        content: msg.content,
      });
    }
    return result;
  }

  private async handleNormalResponse(response: Response, model: string): Promise<Response> {
    const data = await response.json() as any;
    const anthropicResponse = {
      id: data.id,
      type: "message",
      role: "assistant",
      model: model,
      content: [{ type: "text", text: data.choices[0]?.message?.content || "" }],
      stop_reason: data.choices[0]?.finish_reason === "stop" ? "end_turn" : data.choices[0]?.finish_reason,
      stop_sequence: null,
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
      },
    };
    return Response.json(anthropicResponse);
  }

  private handleStreamResponse(response: Response, model: string): Response {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = response.body?.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    (async () => {
      let messageId = "msg_" + Math.random().toString(36).slice(2);
      
      // 发送消息开始事件
      await writer.write(encoder.encode(`event: message_start\ndata: ${JSON.stringify({
        type: "message_start",
        message: { id: messageId, type: "message", role: "assistant", model: model, usage: { input_tokens: 0, output_tokens: 0 } }
      })}\n\n`));

      await writer.write(encoder.encode(`event: content_block_start\ndata: ${JSON.stringify({
        type: "content_block_start",
        index: 0,
        content_block: { type: "text", text: "" }
      })}\n\n`));

      let buffer = "";
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ") || trimmed.includes("[DONE]")) continue;
          
          try {
            const openAIIn = JSON.parse(trimmed.slice(6));
            const content = openAIIn.choices[0]?.delta?.content;
            
            if (content) {
              await writer.write(encoder.encode(`event: content_block_delta\ndata: ${JSON.stringify({
                type: "content_block_delta",
                index: 0,
                delta: { type: "text_delta", text: content }
              })}\n\n`));
            }

            const finishReason = openAIIn.choices[0]?.finish_reason;
            if (finishReason) {
              await writer.write(encoder.encode(`event: message_delta\ndata: ${JSON.stringify({
                type: "message_delta",
                delta: { stop_reason: finishReason === "stop" ? "end_turn" : finishReason, stop_sequence: null },
                usage: { output_tokens: 0 }
              })}\n\n`));
            }
          } catch (e) {}
        }
      }

      await writer.write(encoder.encode(`event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: 0 })}\n\n`));
      await writer.write(encoder.encode(`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`));
      await writer.close();
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }
}

export const anthropicIngress = new AnthropicIngressService();
