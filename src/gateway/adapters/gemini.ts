import type { Account, Adapter, ChatMessage, ChatRequest } from "../types.js";

/**
 * Gemini 适配器
 * 处理 OpenAI -> Google Gemini 格式转换及流式转换
 */
export class GeminiAdapter implements Adapter {
  async handleChat(request: ChatRequest, account: Account): Promise<Response> {
    const isStream = !!request.stream;
    const method = isStream ? "streamGenerateContent" : "generateContent";
    
    // 确保模型名以 models/ 开头
    const modelId = request.model.startsWith("models/") ? request.model : `models/${request.model}`;
    
    // 使用 v1beta 接口以支持 systemInstruction 等高级功能
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelId}:${method}?key=${account.api_key}`;

    const { systemInstruction, contents } = this.transformMessages(request.messages);

    const geminiReq = {
      contents,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      generationConfig: {
        temperature: request.temperature,
        topP: request.top_p,
        maxOutputTokens: request.max_tokens,
        stopSequences: typeof request.stop === "string" ? [request.stop] : request.stop,
      },
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(geminiReq),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[Gemini Adapter] Google API Error (${response.status}):`, errorData);
      return new Response(errorData, { 
        status: response.status, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    if (isStream) {
      return this.handleStreamResponse(response, request.model);
    } else {
      return this.handleNormalResponse(response, request.model);
    }
  }

  async listModels(account: Account): Promise<any[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${account.api_key}`;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Gemini Adapter] ListModels failed (${response.status}):`, errText);
        return [];
      }
      const data = await response.json() as any;
      
      const models = (data.models || []).map((m: any) => ({
        id: m.name.replace("models/", ""), 
        object: "model",
        created: Date.now(),
        owned_by: account.alias
      }));
      console.log(`[Gemini Adapter] Successfully listed ${models.length} models.`);
      return models;
    } catch (e: any) {
      console.error(`[Gemini Adapter] ListModels fetch error:`, e.message);
      return [];
    }
  }

  private transformMessages(messages: ChatMessage[]) {
    let systemInstruction = "";
    const contents: any[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        const text = Array.isArray(msg.content)
          ? msg.content.map(p => (p as any).text || "").join("")
          : msg.content;
        systemInstruction += (systemInstruction ? "\n" : "") + text;
      } else {
        const parts: any[] = [];
        if (Array.isArray(msg.content)) {
          for (const part of msg.content as any[]) {
            if (part.type === "text") {
              parts.push({ text: part.text });
            } else if (part.type === "image_url") {
              const url = part.image_url?.url;
              if (url?.startsWith("data:")) {
                const [header, data] = url.split(",");
                const mimeType = header.match(/:(.*?);/)?.[1] || "image/jpeg";
                parts.push({ inline_data: { mime_type: mimeType, data } });
              } else if (url) {
                parts.push({ file_data: { mime_type: "image/jpeg", file_uri: url } });
              }
            } else if (part.type === "document") {
              if (part.source?.type === "base64") {
                parts.push({ inline_data: { mime_type: part.source.media_type || "application/pdf", data: part.source.data } });
              } else if (part.source?.type === "url") {
                parts.push({ file_data: { mime_type: "application/pdf", file_uri: part.source.url } });
              }
            } else if (part.type === "input_audio") {
              parts.push({ inline_data: { mime_type: `audio/${part.input_audio.format}`, data: part.input_audio.data } });
            } else if (part.type === "tool_use") {
              parts.push({ functionCall: { name: part.name, args: part.input } });
            } else if (part.type === "tool_result") {
              parts.push({ functionResponse: { name: part.tool_use_id, response: { content: part.content } } });
            } else if (part.type === "thinking") {
              parts.push({ thought: true, text: part.thinking });
            } else if (part.type === "refusal") {
              parts.push({ text: part.refusal });
            }
            // file: Gemini 暂不支持 OpenAI file_id，跳过
          }
        } else {
          parts.push({ text: msg.content || "" });
        }

        if (parts.length > 0) {
          contents.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts,
          });
        }
      }
    }

    return { systemInstruction, contents };
  }

  private async handleNormalResponse(response: Response, model: string): Promise<Response> {
    const data = await response.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const openAIResponse = {
      id: "gemini-" + Math.random().toString(36).slice(2),
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: text,
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 0, // Gemini 响应中可能不带这个，暂时 Mock
        completion_tokens: 0,
        total_tokens: 0,
      },
    };

    // 保留原始响应的配额相关头
    const headers = new Headers({
      'Content-Type': 'application/json'
    });

    const quotaHeaders = [
      'x-ratelimit-limit-requests',
      'x-ratelimit-remaining-requests',
      'x-ratelimit-limit-tokens',
      'x-ratelimit-remaining-tokens',
      'x-quota-total',
      'x-quota-remaining'
    ];

    for (const key of quotaHeaders) {
      const value = response.headers.get(key);
      if (value) headers.set(key, value);
    }

    return new Response(JSON.stringify(openAIResponse), { headers });
  }

  /**
   * Gemini 的流式响应是 JSON 块的流（SSE 格式，但内容是 JSON 数组或对象）
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
        
        // Gemini 流式响应通常是 [{}, {}, ...] 的形式，
        // 我们需要剥离外层的方括号并解析每个独立的 JSON 对象
        // 简单处理：假设每个块都是一个完整的 JSON 对象或部分对象
        const chunks = this.parseGeminiStreamBuffer(buffer);
        buffer = chunks.remaining;

        for (const chunk of chunks.items) {
          const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const openAIEvent = {
              id: "chatcmpl-" + Math.random().toString(36).slice(2),
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
            };
            await writer.write(encoder.encode(`data: ${JSON.stringify(openAIEvent)}\n\n`));
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
   * 用状态机解析 Gemini 的流式缓冲区，正确处理字符串内含花括号的情况
   */
  private parseGeminiStreamBuffer(buffer: string) {
    const items: any[] = [];
    let cleanBuffer = buffer.trim();

    if (cleanBuffer.startsWith("[")) cleanBuffer = cleanBuffer.slice(1);
    if (cleanBuffer.startsWith(",")) cleanBuffer = cleanBuffer.slice(1);

    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < cleanBuffer.length; i++) {
      const ch = cleanBuffer[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === "\\" && inString) {
        escaped = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (ch === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0 && start !== -1) {
          const jsonStr = cleanBuffer.slice(start, i + 1);
          try {
            items.push(JSON.parse(jsonStr));
          } catch (e) {}
          start = -1;
        }
      }
    }

    const remaining = start === -1 ? "" : cleanBuffer.slice(start);
    return { items, remaining };
  }
}

export const geminiAdapter = new GeminiAdapter();
