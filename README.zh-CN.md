<p align="center">
  <img src="./logo.svg" width="120" alt="LLMux Logo">
</p>

<p align="center">
  <h1 align="center">LLMux</h1>
  <p align="center">为开发者打造的个人本地 AI API 网关与多路复用器</p>
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
  <a href="./README.md">English</a> | <strong>中文</strong>
</p>

---

- 新仓库：https://github.com/zhMoody/llmux-cli-rs

---

## 为什么需要 LLMux？

> LLMux 是一个**个人本地优先**的工具，运行在你自己的机器上，面向独立开发者或小团队使用，而非作为共享的生产级 API 网关。

作为开发者，你大概同时持有 OpenAI、anthropic、Google 等多家平台的账号。每个平台有自己的 SDK、限速策略和接口格式。某个账号触发限速，你就得手动切换、重新配置工具。你想用 Claude Code，但需要 Gemini 的吞吐量。你想把 API 访问权限分享给团队，又不想暴露真实密钥。

LLMux 解决的就是这些问题。它是一个运行在本地机器上的网关，对外暴露统一的单一入口。你的工具只和 LLMux 对话，路由、协议转换、负载均衡、密钥隔离、用量追踪全部交给 LLMux 处理。

## 它能做什么

**统一入口。** 将任何兼容 OpenAI 格式的客户端指向 `http://localhost:25975/v1`，即可访问所有已配置的 provider 和模型。

**anthropic Ingress（协议跨越）。** 原生支持 anthropic 协议。Claude Code 等工具可以通过 LLMux 的协议转换层直接调用 Gemini 或 OpenAI 模型，客户端无需任何修改。

**Quota Radar（配额雷达）。** 解析上游响应头中的 `x-ratelimit-*` 信息，在模型卡片上以进度条形式展示 Token 剩余量。进度条显示该模型所有账号中的最低配额，并附带数据最后更新时间戳。每次模型测试后自动刷新。需要上游厂商在响应头中返回标准的限速头信息（OpenAI、Anthropic 支持；智谱、Gemini 等厂商目前不返回此类头信息）。如果厂商未返回这些头，模型卡片只会显示绿色状态点和延迟（秒）。

**自愈负载均衡器。** 当某个账号触发限速或出现故障，LLMux 在毫秒级内自动切换至下一个可用账号。无需人工干预，请求不中断。

> **注意：** LLMux 的设计目标是多账号负载分发。自愈和负载均衡能力依赖于每个 Provider 下配置多个账号。在共享或团队使用场景中，建议为每个 Provider 添加多个账号，以获得最佳的吞吐量和可用性。

**模型别名。** 将 `claude-3-7-sonnet-20250219` 这样的冗长 ID 映射为 `c37` 这样的短别名。随时替换底层模型，客户端配置无需变动。

**API Key 权限隔离。** 生成网关密钥，并为每个密钥配置允许访问的模型白名单。可安全地将访问权限分发给团队成员或测试环境，不会暴露实际的 provider 凭证。

**用量情报。** 全量记录每次请求的延迟、Token 消耗、成功/失败状态。仪表盘以实时指标可视化呈现：

- **账号利用率** — 显示哪个账号处理了最多流量，以及负载分布的均衡程度
- **故障转移保护** — 追踪触发限速时的自动账号切换，显示成功率和救回的请求数
- **性能分析** — 按模型和账号展示延迟趋势、成功率和 Token 消耗
  所有指标均基于真实请求数据，无估算或占位符。

**自定义 Provider。** 在内置 provider 之外，可接入任何兼容 OpenAI 格式的端点（Ollama、DeepSeek、本地推理服务器等）。

## 安装

**推荐方式 — npm 全局安装：**

```bash
npm install -g llmux-cli
```

**从源码运行：**

```bash
git clone https://github.com/zhMoody/llmux-cli.git
cd llmux-cli
bun install
cd ui
bun install
cd ..
bun run build
bun run start
```

## 使用方式

启动网关：

```bash
llmux start
```

管理后台会自动在浏览器打开，地址为 `http://localhost:25975`。

**5 步完成接入：**

1. **Accounts** — 添加你的 API Key（支持 OpenAI、anthropic、Gemini 及自定义端点）
2. **Models** — 创建模型别名，并运行连接测试
3. **Keys** — 生成网关 API Key，按需配置模型白名单
4. **客户端** — 将工具的 Base URL 设为 `http://localhost:25975/v1`，API Key 填入网关密钥
5. 完成 — 路由、故障切换、用量追踪全部由 LLMux 自动处理

## CLI 命令

> 目前仅实现了 `start` 命令。`stop`、`status` 以及守护进程管理等命令将在后续版本中加入。

| 命令              | 说明           |
| ----------------- | -------------- |
| `llmux start`     | 启动网关       |
| `llmux --version` | 打印当前版本号 |

**计划中（尚未实现）：**

| 命令 / 参数              | 说明                           |
| ------------------------ | ------------------------------ |
| `llmux start --port <n>` | 覆盖默认端口（25975）          |
| `llmux start --browser`  | 启动时自动在浏览器中打开仪表盘 |
| `llmux stop`             | 停止网关守护进程               |
| `llmux status`           | 查看服务健康状态               |

## 环境变量

| 变量名       | 默认值            | 说明                                       |
| ------------ | ----------------- | ------------------------------------------ |
| `PORT`       | `25975`           | 网关与仪表盘端口                           |
| `LOG_LEVEL`  | `info`            | 日志级别：`debug`、`info`、`warn`、`error` |
| `DATA_DIR`   | `~/.config/llmux` | `db.sqlite` 和日志的存储目录               |
| `MASTER_KEY` | （自动生成）      | 存储凭证的加密密钥                         |

## 管理后台

访问 `http://localhost:25975` 打开 Web UI：

- **Dashboard** — Token 用量、延迟分布、请求成功率和账号利用率的实时图表
- **Accounts** — 启用/禁用账号，设置路由权重
- **Models** — 管理模型别名，将短名称映射到 provider 的模型 ID，查看配额剩余量及更新时间戳
- **Keys** — 创建和管理网关 API Key，配置模型白名单
- **Usage** — 详细分析，包含账号利用率指标、故障转移统计和可导出的 CSV 报告
- **Settings** — 全局配置项

## 技术说明

- 完全本地运行。除了你主动发出的 provider 请求，没有任何数据离开你的机器。
- 嵌入式 SQLite，无需安装数据库软件。数据存储在 `~/.config/llmux`。
- 基于 Bun 原生 HTTP 服务器和 `fetch`，代理附加延迟极低。
- 全量 TypeScript，对 SSE 流式传输、多模态 Payload 和协议适配器做了严格的类型校验。

## 开源协议

[AGPL-3.0](LICENSE) — © 2026 Moody
