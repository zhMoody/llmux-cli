# 🎉 LLMux v1.0.0: The Multiplexer

经过持续的打磨与架构进化，LLMux 终于迎来了首个满血的黑马版本发版！
我们彻底重构了底层的分发逻辑，并为您献上了这台纯正无依赖的 "单文件大模型路由器"。

## 💡 核心特性 (Features)
- 🚀 **极速引擎**：采用 Bun 原生网络层及内置 `bun:sqlite`，数据极速落盘，0 等待延迟。
- 📦 **零门槛双模式分发**：支持真正的 `npm install -g` 跨端极速拉取并执行二进制文件；也支持原生 Bun 源码环境直跑。
- 📊 **雷达面板**：原生全端多接口 Token/TPS 并发看板追踪。
- ⚔️ **多路复用**：支持设置别名（如将三条同模型的过期备用接口映射给唯一的 `gpt-4o` ），流量自动分发、无感知屏蔽死号。

## 📥 安装运行 (Quick Start)

### 方案 A：NPM 自动下载模式（适合大众用户）
```bash
npm install -g llmux-cli
llmux start
```

### 方案 B：Bun 源码编译模式（适合前端极客）
```bash
bun install -g llmux-cli
llmux start
```

或者直接在下方的 **Assets** 列表下载属于你操作系统的独立单体可执行文件直接双击运行！
