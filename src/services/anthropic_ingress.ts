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
        tools: anthropicReq.tools ? this.mapToolsToOpenAI(anthropicReq.tools) : undefined,
        tool_choice: anthropicReq.tool_choice ? this.mapToolChoiceToOpenAI(anthropicReq.tool_choice) : undefined,
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
      if (typeof msg.content === "string") {
        result.push({
          role: msg.role,
          content: msg.content,
        });
      } else if (Array.isArray(msg.content)) {
        // 处理 Anthropic 的内容块数组 (包含 text, image, tool_use, tool_result)
        const openAIParts: any[] = [];
        const toolCalls: any[] = [];

        for (const block of msg.content) {
          if (block.type === "text") {
            openAIParts.push({ type: "text", text: block.text });
          } else if (block.type === "image") {
            // Anthropic image -> OpenAI image_url
            openAIParts.push({
              type: "image_url",
              image_url: {
                url: `data:${block.source?.media_type || "image/jpeg"};base64,${block.source?.data}`
              }
            });
          } else if (block.type === "tool_use") {
            toolCalls.push({
              id: block.id,
              type: "function",
              function: {
                name: block.name,
                arguments: JSON.stringify(block.input),
              },
            });
          } else if (block.type === "tool_result") {
            // Anthropic 的 tool_result 对应 OpenAI 的 tool 角色消息
            result.push({
              role: "tool",
              content: typeof block.content === "string" ? block.content : JSON.stringify(block.content),
              tool_call_id: block.tool_use_id,
            } as any);
          }
        }

        if (openAIParts.length > 0 || toolCalls.length > 0) {
          // 如果只有一个文本块，则打平为字符串以获得最佳兼容性
          // 如果有多个块或包含图片，则保留数组格式
          let finalContent: any = null;
          if (openAIParts.length === 1 && openAIParts[0].type === "text") {
            finalContent = openAIParts[0].text;
          } else if (openAIParts.length > 0) {
            finalContent = openAIParts;
          }

          result.push({
            role: msg.role,
            content: finalContent,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          } as any);
        }
      }
    }
    return result;
  }

  private mapToolsToOpenAI(anthropicTools: any[]): any[] {
    return anthropicTools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }

  private mapToolChoiceToOpenAI(anthropicChoice: any): any {
    if (typeof anthropicChoice === "string") return anthropicChoice;
    if (anthropicChoice.type === "auto") return "auto";
    if (anthropicChoice.type === "any") return "required";
    if (anthropicChoice.type === "tool") {
      return {
        type: "function",
        function: { name: anthropicChoice.name },
      };
    }
    return "auto";
  }

  private async handleNormalResponse(response: Response, model: string): Promise<Response> {
    const data = await response.json() as any;
    const choice = data.choices[0];
    const content: any[] = [];

    if (choice.message?.content) {
      content.push({ type: "text", text: choice.message.content });
    }

    if (choice.message?.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        });
      }
    }

    const anthropicResponse = {
      id: data.id,
      type: "message",
      role: "assistant",
      model: model,
      content: content,
      stop_reason: choice.finish_reason === "tool_calls" ? "tool_use" : (choice.finish_reason === "stop" ? "end_turn" : choice.finish_reason),
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
      let startedToolIndices = new Set<number>();
      
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
            const delta = openAIIn.choices[0]?.delta;
            
            // 1. 处理文本增量
            if (delta?.content) {
              await writer.write(encoder.encode(`event: content_block_delta\ndata: ${JSON.stringify({
                type: "content_block_delta",
                index: 0,
                delta: { type: "text_delta", text: delta.content }
              })}\n\n`));
            }

            // 2. 处理工具调用增量
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index + 1; // 文本是 index 0，所以工具从 1 开始
                if (!startedToolIndices.has(tc.index)) {
                  startedToolIndices.add(tc.index);
                  // 发送工具开始事件
                  await writer.write(encoder.encode(`event: content_block_start\ndata: ${JSON.stringify({
                    type: "content_block_start",
                    index: idx,
                    content_block: {
                      type: "tool_use",
                      id: tc.id,
                      name: tc.function?.name,
                    }
                  })}\n\n`));
                }

                if (tc.function?.arguments) {
                  // 发送工具参数增量
                  await writer.write(encoder.encode(`event: content_block_delta\ndata: ${JSON.stringify({
                    type: "content_block_delta",
                    index: idx,
                    delta: { type: "input_json_delta", partial_json: tc.function.arguments }
                  })}\n\n`));
                }
              }
            }

            const finishReason = openAIIn.choices[0]?.finish_reason;
            if (finishReason) {
              await writer.write(encoder.encode(`event: message_delta\ndata: ${JSON.stringify({
                type: "message_delta",
                delta: { 
                  stop_reason: finishReason === "tool_calls" ? "tool_use" : (finishReason === "stop" ? "end_turn" : finishReason), 
                  stop_sequence: null 
                },
                usage: { output_tokens: 0 }
              })}\n\n`));
            }
          } catch (e) {}
        }
      }

      // 结束所有内容块
      await writer.write(encoder.encode(`event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: 0 })}\n\n`));
      for (const idx of startedToolIndices) {
        await writer.write(encoder.encode(`event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: idx + 1 })}\n\n`));
      }
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
