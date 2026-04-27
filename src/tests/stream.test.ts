import { expect, test, describe, spyOn } from "bun:test";
import { anthropicAdapter } from "../gateway/adapters/anthropic";
import { geminiAdapter } from "../gateway/adapters/gemini";

describe("Adapters Stream Transformation Logic", () => {
  const mockAccount = {
    id: 1,
    alias: "test",
    provider_id: "test",
    api_key: "key",
    is_active: 1,
    weight: 1
  };

  const streamRequest = {
    model: "test-model",
    messages: [{ role: "user" as const, content: "hi" }],
    stream: true
  };

  test("Anthropic SSE Stream Transformation", async () => {
    const anthropicEvents = [
      'data: {"type": "message_start", "message": {"id": "msg_123"}}\n\n',
      'data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "He"}}\n\n',
      'data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "llo"}}\n\n',
      'data: {"type": "message_delta", "delta": {"stop_reason": "end_turn"}}\n\n'
    ];

    // @ts-ignore
    spyOn(global, "fetch").mockImplementation(async () => {
      const stream = new ReadableStream({
        async start(controller) {
          for (const event of anthropicEvents) {
            controller.enqueue(new TextEncoder().encode(event));
          }
          controller.close();
        }
      });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
    });

    const response = await anthropicAdapter.handleChat(streamRequest, mockAccount);
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let result = "";

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      result += decoder.decode(value);
    }

    expect(result).toContain('data: {"id":"msg_123"');
    expect(result).toContain('"content":"He"');
    expect(result).toContain('"content":"llo"');
    expect(result).toContain('"finish_reason":"stop"');
    expect(result).toContain('data: [DONE]');
  });

  test("Gemini JSON Stream Transformation", async () => {
    // Gemini 格式比较特殊，可能是包含 JSON 对象的片段
    const geminiChunks = [
      '[\r\n',
      '{\n  "candidates": [{"content": {"parts": [{"text": "Hel"}]}}]\n}',
      ',\r\n{\n  "candidates": [{"content": {"parts": [{"text": "lo"}]}}]\n}',
      '\r\n]'
    ];

    // @ts-ignore
    spyOn(global, "fetch").mockImplementation(async () => {
      const stream = new ReadableStream({
        async start(controller) {
          for (const chunk of geminiChunks) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          controller.close();
        }
      });
      return new Response(stream);
    });

    const response = await geminiAdapter.handleChat(streamRequest, mockAccount);
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let result = "";

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      result += decoder.decode(value);
    }

    expect(result).toContain('"content":"Hel"');
    expect(result).toContain('"content":"lo"');
    expect(result).toContain('data: [DONE]');
  });
});
