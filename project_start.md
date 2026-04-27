# llmux — 产品功能规格

> LLM + mux（multiplexer），本地 AI API 聚合工具。
> 所有数据存在用户本地，Key 永远不离开你的设备。

-----

## 一、产品定位

一个运行在本地的命令行工具，统一聚合多个 AI 服务商的多个账户，对外暴露标准 OpenAI 兼容接口，供 Cursor、Claude Code、任意 SDK 调用。

**核心价值：**

- 一个 base URL 调用所有模型
- 多账户智能调度，429 自动切换
- 数据完全本地，Key 不经过任何第三方
- 全开源，AGPL-3.0

-----

## 二、技术栈

|层       |技术                    |
|--------|----------------------|
|CLI / 后端|Bun + TypeScript      |
|Web UI  |React + Vite          |
|数据库     |SQLite（Bun 原生支持）      |
|Env 验证  |safe-env              |
|加密      |AES-256-GCM（存 API Key）|

-----

## 三、目录结构

```
llmux/
├── src/
│   ├── cli/                  # CLI 入口和命令
│   │   ├── index.ts          # 主入口
│   │   └── commands/
│   │       ├── start.ts      # llmux start
│   │       ├── stop.ts       # llmux stop
│   │       └── status.ts     # llmux status
│   ├── gateway/              # 本地 HTTP Gateway
│   │   ├── index.ts          # 服务启动
│   │   ├── routes/
│   │   │   ├── chat.ts       # POST /v1/chat/completions
│   │   │   └── models.ts     # GET /v1/models
│   │   └── adapters/         # 各 Provider 格式转换
│   │       ├── anthropic.ts
│   │       ├── openai.ts
│   │       ├── gemini.ts
│   │       └── custom.ts     # 自定义 Provider
│   ├── services/
│   │   ├── dispatcher.ts     # 账户调度核心
│   │   ├── health.ts         # 账户探活
│   │   ├── usage.ts          # 用量记录
│   │   └── crypto.ts         # Key 加解密
│   ├── db/
│   │   ├── schema.ts         # 数据库结构
│   │   ├── migrations/       # 数据库迁移
│   │   └── index.ts
│   └── ui/                   # React + Vite 打包后内嵌
│       └── dist/             # 构建产物，随二进制发布
│
├── ui/                       # Web UI 源码
│   ├── src/
│   │   ├── routes/
│   │   │   ├── dashboard.tsx
│   │   │   ├── accounts.tsx
│   │   │   ├── models.tsx
│   │   │   ├── usage.tsx
│   │   │   ├── settings.tsx
│   │   │   └── about.tsx     # 捐赠入口
│   │   ├── components/
│   │   └── stores/           # Zustand
│   └── vite.config.ts
│
├── package.json
└── README.md
```

-----

## 四、数据目录

```
macOS / Linux  →  ~/.config/llmux/
Windows        →  %APPDATA%\llmux\

内部结构：
  db.sqlite      数据库
  config.json    基础配置（端口等）
  logs/          日志文件（可选）
```

程序更新不影响数据，数据目录与二进制完全分离。

-----

##五、CLI 命令

```bash
llmux start                   # 启动服务，自动打开浏览器
llmux start --port 8080       # 自定义端口
llmux start --no-browser      # 不自动打开浏览器
llmux stop                    # 停止服务
llmux status                  # 查看运行状态
llmux logs                    # 查看日志
```

启动后输出：

```
llmux v0.1.0
Gateway:  http://localhost:25975
Web UI:   http://localhost:25975/ui
```

-----

## 六、默认配置

```json
{
  "port": 25975,
  "openBrowserOnStart": true,
  "logLevel": "info"
}
```

-----

## 七、Provider 管理

### 7.1 内置 Provider

|Provider     |说明         |
|-------------|-----------|
|Anthropic    |官方 API     |
|OpenAI       |官方 API     |
|Google Gemini|官方 API     |
|Ollama       |本地模型，用户自己运维|

### 7.2 自定义 Provider

- 任何符合 OpenAI 兼容格式的服务均可接入
- 填写 base URL 即可，Gateway 统一处理
- Ollama 本质上是自定义 Provider 的特例

### 7.3 账户管理

同一 Provider 可添加多个账户，每个账户包含：

```
alias          别名（方便识别）
api_key        加密存储
is_active      启用 / 禁用
weight         调度权重（默认 1）
notes          备注
created_at     创建时间
```

API Key 使用 AES-256-GCM 加密后存入 SQLite，不明文保存。

### 7.4 账户健康检测

- 定时自动探活（发送极小请求验证 Key 可用性）
- 健康状态：正常 / 限速 / 不可用
- 不可用时自动从调度池移除，恢复后重新加入
- 历史探活记录可查

-----

## 八、模型管理

### 8.1 模型列表接口

```
GET /v1/models
```

- 返回 OpenAI 兼容格式
- 动态生成，来源：当前已配置且健康的账户对应的模型
- 某账户不可用时，其对应模型自动从列表移除
- 支持从各 Provider 实时拉取最新模型列表

### 8.2 模型别名

- 支持为任意模型设置自定义别名
- 例：`fast` → `claude-haiku-4-5`
- 别名对外暴露，调用方可直接使用

-----

## 九、Gateway 接口

### 9.1 对外暴露

```
base URL:  http://localhost:25975
```

任何支持自定义 base URL 的客户端直接接入：

```bash
# Cursor、Claude Code、任意 SDK
base URL = http://localhost:25975
API Key  = 随便填（本地不验证，或可开启验证）
```

### 9.2 接口列表

```
# OpenAI 兼容接口（供外部工具调用）
POST /v1/chat/completions
GET  /v1/models

# 内部管理接口（Web UI 调用）
GET    /api/accounts
POST   /api/accounts
PUT    /api/accounts/:id
DELETE /api/accounts/:id

GET    /api/providers
POST   /api/providers         # 添加自定义 Provider

GET    /api/models
PUT    /api/models/:id/alias  # 设置模型别名

GET    /api/usage
GET    /api/usage/summary

GET    /api/health
GET    /api/health/:accountId

GET    /api/settings
PUT    /api/settings
```

### 9.3 本地访问安全

默认只监听 `127.0.0.1`，不对外网暴露。

可选开启简单的 token 验证（settings 里配置），防止同机器其他进程滥用。

-----

## 十、智能调度

### 10.1 调度策略

|策略         |说明               |
|-----------|-----------------|
|Round Robin|平均轮询所有账户         |
|Weighted   |按权重比例分配请求        |
|Least Used |优先使用当前窗口期内用量最少的账户|
|Failover   |主账户优先，失败自动切换备用   |

每个 Provider 可单独配置调度策略。

### 10.2 智能切换触发条件

- 收到 `429 Rate Limit` → 立即切换账户重试，调用方无感知
- 账户连续失败 N 次 → 触发熔断，移出调度池
- 响应头剩余请求数低于阈值 → 提前切换，不等真正报错

### 10.3 流式响应

- 完整支持 SSE 流式响应透传
- 各 Provider 流式格式差异在 adapter 层统一处理

-----

## 十一、用量统计

### 11.1 记录内容

每条请求记录：

```
timestamp       时间戳
account_id      实际使用的账户
provider        服务商
model           模型
input_tokens    输入 token 数
output_tokens   输出 token 数
latency_ms      请求耗时
success         是否成功
error           失败原因（如有）
```

### 11.2 统计维度

- 按账户
- 按模型
- 按 Provider
- 全局汇总

### 11.3 时间粒度

- 按请求（明细）
- 按小时
- 按天
- 按月

### 11.4 费用估算

- 公式：`估算费用 = input_tokens × input单价 + output_tokens × output单价`
- 纯本地计算，不涉及任何收费
- Ollama 等本地模型费用显示 $0，按请求次数统计

**单价数据来源：`llm-prices`（simonw 维护的开源项目）**

```
数据地址：https://raw.githubusercontent.com/simonw/llm-prices/main/current-v1.json
同步频率：每天一次（启动时检查，超过 24 小时自动拉取）
本地缓存：存入 SQLite，断网时使用缓存数据
回退策略：拉取失败不影响正常使用，继续用上次缓存
```

数据格式示例：

```json
{
  "prices": [
    {
      "id": "claude-sonnet-4-20250514",
      "vendor": "anthropic",
      "input": 3.0,
      "output": 15.0,
      "input_cached": 0.3
    }
  ]
}

---

## 十二、数据库结构

```sql
accounts          Provider 账户（含加密 Key）
providers         自定义 Provider 配置
model_aliases     模型别名映射
model_prices      各模型单价（从 llm-prices 自动同步，本地缓存）
usage_logs        每条请求用量记录
health_checks     账户探活历史
settings          应用配置
```

-----

## 十三、Web UI 页面

### Dashboard

- 今日用量概览
- 账户健康状态总览
- 最近请求记录
- 费用估算汇总

### Accounts（账户管理）

- 账户列表，显示健康状态
- 添加 / 编辑 / 删除账户
- 每个账户的用量和健康历史

### Models（模型管理）

- 当前可用模型列表
- 设置模型别名
- 各模型单价展示（来自 llm-prices，只读）
- 上次价格同步时间，支持手动触发同步

### Usage（用量统计）

- 用量趋势图
- 维度切换：账户 / 模型 / Provider
- 时间粒度切换：小时 / 天 / 月
- 费用估算

### Settings（设置）

- 端口配置
- 启动行为
- 调度策略
- 本地访问 token（可选）
- 数据导出 / 清除

### About

- 版本信息
- 开源协议（AGPL-3.0）
- 捐赠入口（爱发电）
- GitHub 链接

-----

## 十四、开源与分发

### License

AGPL-3.0，修改后必须开源。

### 分发方式

```
GitHub Releases   → 各平台二进制直接下载（主要）
npm / bun         → bun install -g llmux
Homebrew Tap      → brew install yourname/llmux/llmux（macOS）
Docker            → docker run llmux/llmux（技术用户 / NAS）
```

### 捐赠

- 爱发电（主要，国内用户友好）
- 入口：About 页面 + GitHub README 顶部

-----

## 十五、暂缓 / 不做

- 移动端
- 团队 / 拼车功能
- 余额 / 充值 / 计费体系
- 托管版
- 请求内容日志（隐私敏感）
- 桌面 GUI 应用（Electron / Tauri）
- 安装向导 / 壳子