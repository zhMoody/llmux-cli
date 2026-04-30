<p align="center">
  <img src="./logo.svg" width="120" alt="LLMux Logo">
</p>

<p align="center">
  <h1 align="center">LLMux</h1>
  <p align="center">A local AI API gateway and multiplexer for developers</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/llmux-cli"><img src="https://img.shields.io/npm/v/llmux-cli?color=3399FF" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/llmux-cli"><img src="https://img.shields.io/npm/dm/llmux-cli?color=3399FF" alt="npm downloads"></a>
  <img src="https://img.shields.io/badge/Bun-1.1-blue?logo=bun" alt="Bun">
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript" alt="TypeScript">
  <a href="https://github.com/zhMoody/llmux-cli"><img src="https://img.shields.io/github/stars/zhMoody/llmux-cli?style=social" alt="GitHub stars"></a>
  <img src="https://img.shields.io/github/last-commit/zhMoody/llmux-cli" alt="Last Commit">
  <img src="https://img.shields.io/badge/License-AGPL--3.0-orange" alt="AGPL-3.0">
</p>

<p align="center">
  <strong>English</strong> | <a href="./README.zh-CN.md">中文</a>
</p>

---

## Why LLMux?

As a developer, you probably have accounts across OpenAI, the provider, and Google — each with their own SDKs, rate limits, and API formats. You hit a quota cap on one account mid-session, switch manually, and re-configure your tools. You want to use the assistant but need Gemini's throughput. You want to share API access with teammates without exposing your actual keys.

LLMux solves all of this. It's a local gateway that runs on your machine and exposes a single unified endpoint. Your tools talk to LLMux; LLMux handles the rest — routing, protocol translation, load balancing, key scoping, and usage tracking.

## What It Does

**One endpoint for everything.** Point any OpenAI-compatible client to `http://localhost:25975/v1` and reach any model across any provider.

**the provider Ingress.** Tools built natively for the provider (like the assistant) can call Gemini or OpenAI models through LLMux's protocol translation layer — no client-side changes required.

**Quota Radar.** LLMux reads `x-ratelimit-*` headers from upstream providers and tracks remaining RPM and TPM per account in real time. You see exactly where you stand before hitting a 429.

**Self-Healing Load Balancer.** When an account is rate-limited or unhealthy, LLMux automatically routes to the next available account in milliseconds. No manual intervention, no dropped requests.

**Model Aliases.** Map verbose model IDs like `claude-3-7-sonnet-20250219` to short aliases like `c37`. Swap the underlying model anytime without touching client configuration.

**API Key Scoping.** Generate gateway keys and restrict each to a specific set of allowed models. Share access safely with teammates or test environments without exposing provider credentials.

**Usage Intelligence.** Every request is logged — latency, token counts, success/failure, cost. The dashboard visualizes this with high-density charts, drillable by account and alias.

**Custom Providers.** Add any OpenAI-compatible endpoint (Ollama, DeepSeek, local inference servers) alongside the built-in providers.

## Installation

**Recommended — global npm install:**
```bash
npm install -g llmux-cli
```

**From source:**
```bash
git clone https://github.com/zhMoody/llmux-cli.git
cd llmux-cli
bun install
bun run dev
```

## Usage

Start the gateway:
```bash
llmux start
```

The management dashboard opens automatically at `http://localhost:25975`.

**Setup in 5 steps:**
1. **Accounts** — add your API keys (OpenAI, the provider, Gemini, or any custom endpoint)
2. **Models** — create aliases and run connection tests
3. **Keys** — generate a gateway API key, optionally restrict to specific models
4. **Client** — set your tool's Base URL to `http://localhost:25975/v1` and API key to your gateway key
5. Done — LLMux handles routing, failover, and tracking automatically

## CLI Reference

| Command | Description |
|---|---|
| `llmux start` | Start the gateway |
| `llmux --version` | Print current version |

**Planned (not yet implemented):**

| Command / Flag | Description |
|---|---|
| `llmux start --port <n>` | Override the default port (25975) |
| `llmux start --browser` | Auto-open the dashboard in browser |
| `llmux stop` | Stop the gateway daemon |
| `llmux status` | Check service health |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `25975` | Gateway and dashboard port |
| `LOG_LEVEL` | `info` | Log verbosity: `debug`, `info`, `warn`, `error` |
| `DATA_DIR` | `~/.config/llmux` | Location of `db.sqlite` and logs |
| `MASTER_KEY` | (auto) | Encryption key for stored credentials |

## Dashboard

The web UI at `http://localhost:25975` provides:

- **Dashboard** — real-time charts for token usage, latency distribution, and request success rates
- **Accounts** — enable/disable accounts, set routing weights, view live rate-limit status
- **Models** — manage aliases, map short names to provider model IDs
- **Keys** — create and manage gateway API keys with model whitelists
- **Settings** — global configuration

## Architecture Notes

- Runs entirely locally. No data leaves your machine except the requests you make to providers.
- Embedded SQLite — no database setup required. Data lives in `~/.config/llmux`.
- Built on Bun's native HTTP server and `fetch`. Proxy overhead is sub-millisecond.
- Full TypeScript with strict type checking across SSE streaming, multimodal payloads, and protocol adapters.

## License

[AGPL-3.0](LICENSE) — © 2026 Moody
