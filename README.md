# LLMux
<p align="left">
  <a href="https://www.npmjs.com/package/llmux-cli"><img src="https://img.shields.io/npm/v/llmux-cli?color=3399FF" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/llmux-cli"><img src="https://img.shields.io/npm/dm/llmux-cli?color=3399FF" alt="npm downloads"></a>
  <img src="https://img.shields.io/badge/Bun-1.1-blue?logo=bun" alt="Bun">
  <img src="https://img.shields.io/badge/License-AGPL--3.0-orange" alt="AGPL-3.0">
</p>

[English](README.md) | [中文](README.md)

LLMux (Multiplexer) 是一个专为开发者设计的本地 AI API 流量网关。它通过统一的网关入口，将分散的 OpenAI、Anthropic、Gemini 等 API 聚合并标准化，提供高性能、高可靠的模型访问能力。

---

## 🌟 核心特性

- **🛡️ 协议跨越 (Anthropic Ingress)**
  内置 Anthropic 协议解析层。现在你可以直接使用 **Claude Code** 或其他原生 Anthropic 客户端调用 Gemini/OpenAI，彻底解决工具与模型的绑定问题。

- **📡 配额雷达 (Quota Radar)**
  智能捕获上游响应头（`x-ratelimit-*`）。在仪表盘实时监控各账号的并发限制、每分钟 Token (TPM) 剩余量，告别盲目请求导致的 429 报错。

- **📊 用量情报中心 (Usage Intelligence)**
  全量记录请求日志，通过高密度图表展示延迟分布、Token 消耗及各模型成功率。支持按账号、按别名进行精细化下钻分析。

- **⚙️ 模型别名与路由 (Model Aliases)**
  支持自定义模型 ID。你可以将冗长的 `claude-3-7-sonnet-20250219` 映射为 `c37`，并在后台随时切换底座模型而不影响前端配置。

- **🔐 权限沙盒 (Permission Scoping)**
  支持创建多组 API Key，并为其分配 **Allowed Models（模型白名单）**。你可以安全地将网关分发给测试团队或分享给好友使用。

- **♻️ 账号自愈与轮询 (Self-Healing)**
  后台常驻拨测队列，自动监控账号健康度。支持多账号自动负载均衡与失败重试，当某个账号触发风控或限速时，网关将实现毫秒级无感切换。

---

## 🛠️ 安装与启动

LLMux 追求“开箱即用”，基于 Bun 运行时实现零配置部署。

### 方式 A：NPM 安装 (推荐)
```bash
# 全局安装
npm install -g llmux-cli

# 启动网关
llmux start
```

### 方式 B：源码运行
```bash
# 克隆仓库
git clone https://github.com/zhMoody/llmux-cli.git
cd llmux-cli

# 安装依赖并启动
bun install
bun run dev
```

---

## 🚀 快速上手

1. **进入管理后台**：浏览器打开 `http://localhost:25975`。
2. **接入账号**：在 **Accounts** 页面填入你的 API Key（支持自定义 Base URL）。
3. **配置别名**：在 **Models** 页面为你需要的模型设置 Alias，并进行连接测试。
4. **生成密钥**：在 **Keys** 页面生成你的网关 API Key，并按需配置模型白名单。
5. **客户端接入**：将你的客户端（如 Cursor, NextChat, LobeChat）Base URL 指向 `http://localhost:25975/v1`。

---

## ⚠️ 技术说明

- **本地存储**：LLMux 使用嵌入式 SQLite 存储配置与日志，无需安装数据库软件，数据文件位于用户目录下。
- **高性能**：基于 Bun 的原生 `fetch` 与协程机制，中转延迟几乎为零。
- **类型安全**：后端核心全量采用 TypeScript 深度开发，针对多模态图片、SSE 流式传输做了严格的类型校验，确保请求 Payload 始终合规。

---

## 📄 开源协议
本项目采用 [AGPL-3.0](LICENSE) 协议开源。

© 2026 Moody. Built with ❤️ for Developers.
