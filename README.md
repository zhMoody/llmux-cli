# LLMux

LLMux is a high-performance local AI API aggregation tool and multiplexer. It allows you to securely manage, load-balance, and monitor multiple LLM API keys (such as OpenAI, Anthropic, Gemini, Qwen, custom APIs) through a single unified endpoint.

## Installation

You can install LLMux globally via npm or bun:

```bash
npm install -g llmux-cli
# or
bun install -g llmux-cli
```

## Quick Start

Start the LLMux gateway and Web UI:

```bash
llmux start
```

- **Dashboard UI**: `http://localhost:25975`
- **API Base URL**: `http://localhost:25975/v1`
