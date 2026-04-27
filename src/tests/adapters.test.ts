import { expect, test, describe, spyOn, beforeEach, mock } from "bun:test";
import { anthropicAdapter } from "../gateway/adapters/anthropic";
import { geminiAdapter } from "../gateway/adapters/gemini";
import { openaiAdapter } from "../gateway/adapters/openai";

describe("Adapters Transformation Logic", () => {
  const mockAccount = {
    id: 1,
    alias: "test-account",
    provider_id: "test",
    api_key: "sk-test-key",
    is_active: 1,
    weight: 1
  };

  const mockChatRequest = {
    model: "test-model",
    messages: [
      { role: "system" as const, content: "You are a helper." },
      { role: "user" as const, content: "Hello" }
    ],
    temperature: 0.7
  };

  test("OpenAI Adapter: Header injection", async () => {
    // @ts-ignore
    const globalFetch = spyOn(global, "fetch").mockImplementation(async (url, init) => {
      return new Response(JSON.stringify({ choices: [{ message: { content: "hi" } }] }));
    });

    await openaiAdapter.handleChat(mockChatRequest, mockAccount);
    
    const [url, init] = globalFetch.mock.calls[0];
    expect(init?.headers).toMatchObject({
      "Authorization": "Bearer sk-test-key"
    });
    
    globalFetch.mockRestore();
  });

  test("Anthropic Adapter: Request format conversion", async () => {
    // @ts-ignore
    const globalFetch = spyOn(global, "fetch").mockImplementation(async (url, init) => {
      const body = JSON.parse(init?.body as string);
      expect(body.system).toBe("You are a helper.");
      expect(body.messages[0].role).toBe("user");
      return new Response(JSON.stringify({ 
        id: "ant-1", 
        content: [{ text: "Hello from Claude" }],
        usage: { input_tokens: 10, output_tokens: 20 }
      }));
    });

    const response = await anthropicAdapter.handleChat(mockChatRequest, mockAccount);
    const data = await response.json();

    expect(data.choices[0].message.content).toBe("Hello from Claude");
    expect(data.usage.total_tokens).toBe(30);
    
    globalFetch.mockRestore();
  });

  test("Gemini Adapter: Request format conversion", async () => {
    // @ts-ignore
    const globalFetch = spyOn(global, "fetch").mockImplementation(async (url, init) => {
      const body = JSON.parse(init?.body as string);
      expect(body.systemInstruction.parts[0].text).toBe("You are a helper.");
      expect(body.contents[0].role).toBe("user");
      return new Response(JSON.stringify({ 
        candidates: [{ content: { parts: [{ text: "Hello from Gemini" }] } }]
      }));
    });

    const response = await geminiAdapter.handleChat(mockChatRequest, mockAccount);
    const data = await response.json();

    expect(data.choices[0].message.content).toBe("Hello from Gemini");
    
    globalFetch.mockRestore();
  });
});
