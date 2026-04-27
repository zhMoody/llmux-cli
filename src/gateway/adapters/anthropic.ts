import type { Account, Adapter, ChatMessage, ChatRequest } from "../types.js";

/**
 * Anthropic 适配器
 * 处理 OpenAI -> Claude 格式转换及 SSE 流式转换
 */
export class AnthropicAdapter implements Adapter {
  async handleChat(request: ChatRequest, account: Account): Promise<Response> {
    const baseUrl = account.base_url || "https://api.anthropic.com/v1";
    const url = `${baseUrl}/messages`;

    // 1. 转换请求体
    const { system, messages } = this.transformMessages(request.messages);
    
    const anthropicReq = {
      model: request.model,
      messages,
      system: system || undefined,
      max_tokens: request.max_tokens || 4096,
      temperature: request.temperature,
      top_p: request.top_p,
      stream: request.stream,
      stop_sequences: typeof request.stop === "string" ? [request.stop] : request.stop,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": account.api_key,
      "anthropic-version": "2023-06-01",
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(anthropicReq),
    });

    if (!response.ok) return response;

    // 2. 处理流式或普通响应
    if (request.stream) {
      return this.handleStreamResponse(response, request.model);
    } else {
      return this.handleNormalResponse(response, request.model);
    }
  }

  async listModels(account: Account): Promise<any[]> {
    const baseUrl = account.base_url || "https://api.anthropic.com/v1";
    const response = await fetch(`${baseUrl}/models`, {
      headers: { 
        "x-api-key": account.api_key,
        "anthropic-version": "2023-06-01"
      },
    });
    if (!response.ok) return [];
    const data = await response.json() as any;
    return (data.data || []).map((m: any) => ({
      id: m.id,
      object: "model",
      created: Date.now(),
      owned_by: account.alias
    }));
  }

  /**
   * 将 OpenAI 消息格式转换为 Anthropic 格式
   */
  private transformMessages(messages: ChatMessage[]) {
    let system = "";
    const filteredMessages: any[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        system += (system ? "\n" : "") + msg.content;
      } else {
        // Claude 角色仅支持 user 和 assistant
        filteredMessages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }
    }

    return { system, messages: filteredMessages };
  }

  /**
   * 处理非流式响应转换
   */
  private async handleNormalResponse(response: Response, model: string): Promise<Response> {
    const data = await response.json() as any;
    const openAIResponse = {
      id: data.id,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: data.content[0]?.text || "",
          },
          finish_reason: data.stop_reason === "end_turn" ? "stop" : data.stop_reason,
        },
      ],
      usage: {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    };

    return Response.json(openAIResponse);
  }

  /**
   * 处理流式响应转换 (SSE)
   */
  private handleStreamResponse(response: Response, model: string): Response {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = response.body?.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    (async () => {
      let buffer = "";
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const anthropicEvent = JSON.parse(line.slice(6));
            const openAIEvent = this.transformStreamEvent(anthropicEvent, model);
            if (openAIEvent) {
              await writer.write(encoder.encode(`data: ${JSON.stringify(openAIEvent)}\n\n`));
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
      await writer.write(encoder.encode("data: [DONE]\n\n"));
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

  /**
   * 转换单个 SSE 事件块
   */
  private transformStreamEvent(event: any, model: string): any {
    const base = {
      id: "chatcmpl-" + Math.random().toString(36).slice(2),
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, delta: {}, finish_reason: null }],
    };

    switch (event.type) {
      case "message_start":
        return { ...base, id: event.message.id };
      case "content_block_delta":
        if (event.delta?.type === "text_delta") {
          base.choices[0].delta = { content: event.delta.text };
          return base;
        }
        break;
      case "message_delta":
        base.choices[0].finish_reason = event.delta?.stop_reason === "end_turn" ? "stop" : event.delta?.stop_reason;
        return base;
      case "message_stop":
        return null;
    }
    return null;
  }
}

export const anthropicAdapter = new AnthropicAdapter();
