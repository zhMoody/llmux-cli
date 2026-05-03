/**
 * 消息角色定义
 */
export type ChatRole = "system" | "user" | "assistant" | "tool";

// ─── 内部 ContentPart 类型（OpenAI 兼容的内部流转格式）────────────────────────

/** 纯文本块 */
export type TextPart = {
  type: "text";
  text: string;
};

/** 图片块（OpenAI 风格，内部流转用；url 可为 data URI 或 HTTP URL） */
export type ImageUrlPart = {
  type: "image_url";
  image_url: {
    url: string;
    /** 图片分辨率提示，仅 OpenAI 视觉模型使用 */
    detail?: "low" | "high" | "auto";
  };
};

/** 文档块（Anthropic 专用：PDF 等文件内容） */
export type DocumentPart = {
  type: "document";
  source:
    | { type: "base64"; media_type: "application/pdf" | string; data: string }
    | { type: "url"; url: string }
    | { type: "file"; file_id: string };
  title?: string;
  /** 是否允许模型引用文档内容 */
  citations?: { enabled: boolean };
};

/** 音频输入块（OpenAI 音频模型专用） */
export type InputAudioPart = {
  type: "input_audio";
  input_audio: {
    data: string; // base64 编码
    format: "wav" | "mp3" | "ogg" | "flac";
  };
};

/** 文件引用块（OpenAI Files API 上传的文件） */
export type FilePart = {
  type: "file";
  file: {
    file_id: string;
    filename?: string;
  };
};

/** 工具调用块（assistant 发起） */
export type ToolUsePart = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

/** 工具结果块（user 角色回传） */
export type ToolResultPart = {
  type: "tool_result";
  tool_use_id: string;
  content: string | ContentPart[];
  /** 标记工具执行失败，Anthropic 专用 */
  is_error?: boolean;
};

/** 推理/思考块（Claude Extended Thinking / DeepSeek reasoning） */
export type ThinkingPart = {
  type: "thinking";
  thinking: string;
  /** Anthropic 签名，多轮对话时必须原样回传 */
  signature?: string;
};

/** 模型拒绝响应块（OpenAI 输出侧） */
export type RefusalPart = {
  type: "refusal";
  refusal: string;
};

/** 所有内部流转的内容块联合类型 */
export type ContentPart =
  | TextPart
  | ImageUrlPart
  | DocumentPart
  | InputAudioPart
  | FilePart
  | ToolUsePart
  | ToolResultPart
  | ThinkingPart
  | RefusalPart;

// ─── 消息结构 ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: ChatRole;
  content: string | ContentPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[]; // OpenAI 格式的工具调用，待工具链重构后收窄类型
  /** 推理内容（跨适配器传递 reasoning_content） */
  reasoning_content?: string;
  /** Anthropic thinking 签名，随 reasoning_content 一起传递 */
  reasoning_signature?: string;
}

// ─── 请求结构 ─────────────────────────────────────────────────────────────────

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

// ─── 账户 & 适配器 ────────────────────────────────────────────────────────────

export interface Account {
  id: number;
  alias: string;
  provider_id: string;
  api_key: string;
  base_url?: string;
  is_active: number;
  weight: number;
}

export interface Adapter {
  handleChat(request: ChatRequest, account: Account): Promise<Response>;
  listModels(account: Account): Promise<any[]>;
}
