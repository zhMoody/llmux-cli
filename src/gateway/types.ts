/**
 * 消息角色定义
 */
export type ChatRole = "system" | "user" | "assistant" | "tool";

/**
 * 消息内容块
 */
export type ContentPart = 
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/**
 * 消息结构
 */
export interface ChatMessage {
  role: ChatRole;
  content: string | ContentPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[]; // 暂时保留 tool_calls 的 any，直到完成工具链重构
}

/**
 * 标准 OpenAI 兼容聊天请求
 */
export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  n?: number;
  max_tokens?: number;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  response_format?: { type: "json_object" | "text" };
  seed?: number;
  tools?: any[];
  tool_choice?: any;
  is_test?: boolean;
}

/**
 * 账户信息（对应数据库 accounts 表）
 */
export interface Account {
  id: number;
  alias: string;
  provider_id: string;
  api_key: string;
  base_url?: string;
  is_active: number;
  weight: number;
}

/**
 * 适配器统一接口
 */
export interface Adapter {
  /**
   * 处理聊天请求
   */
  handleChat(request: ChatRequest, account: Account): Promise<Response>;

  /**
   * 获取可用模型列表
   */
  listModels(account: Account): Promise<any[]>;
}
