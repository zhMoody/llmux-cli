import { expect, test, describe, spyOn, beforeEach } from "bun:test";
import { dispatcher } from "../services/dispatcher";
import { db } from "../db/index";
import { encryptKey } from "../services/crypto";
import { openaiAdapter } from "../gateway/adapters/openai";

describe("Dispatcher Logic", () => {
  beforeEach(() => {
    // 清理并准备测试数据
    db.run("DELETE FROM accounts");
    db.run("DELETE FROM model_aliases");
    
    const key1 = encryptKey("key-1");
    const key2 = encryptKey("key-2");
    
    db.run("INSERT INTO accounts (alias, provider_id, api_key, is_active) VALUES (?, ?, ?, ?)", ["acc1", "openai", key1, 1]);
    db.run("INSERT INTO accounts (alias, provider_id, api_key, is_active) VALUES (?, ?, ?, ?)", ["acc2", "openai", key2, 1]);
    
    db.run("INSERT INTO model_aliases (alias, target_model, provider_id) VALUES (?, ?, ?)", ["my-gpt", "gpt-4o", "openai"]);
  });

  test("Model resolution: Alias and Prefix", () => {
    const res1 = dispatcher.resolveModel("my-gpt");
    expect(res1.targetModel).toBe("gpt-4o");
    expect(res1.providerId).toBe("openai");

    const res2 = dispatcher.resolveModel("claude-3-5");
    expect(res2.providerId).toBe("anthropic");
  });

  test("Dispatcher: Retry on 429", async () => {
    let callCount = 0;
    
    // Mock OpenAI adapter to fail the first time and succeed the second
    // @ts-ignore
    spyOn(openaiAdapter, "handleChat").mockImplementation(async (req, account) => {
      callCount++;
      if (callCount === 1) {
        return new Response("Rate limit", { status: 429 });
      }
      return Response.json({ choices: [{ message: { content: "Success from " + account.alias } }] });
    });

    const response = await dispatcher.dispatchChat({
      model: "gpt-4",
      messages: [{ role: "user", content: "hi" }]
    });

    const data = await response.json();
    expect(callCount).toBe(2);
    expect(data.choices[0].message.content).toContain("Success");
  });
});
