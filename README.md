# VisualVS - AI-Driven Code Topology & Insight Visualizer

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE.txt)
[![VisualVS Version](https://img.shields.io/badge/version-0.4.17-blueviolet.svg)](package.json)

**VisualVS** 是一款专为架构师和高级开发人员打造的 VS Code 深度洞察工具。它将 **LLM (大语言模型)**、**LangChain** 和 **Memgraph 属性图数据库** 完美融合，通过高颜值的霓虹风格拓扑图，将枯燥的代码逻辑转化为可感知的视觉资产。

---

## 💎 为什么选择 VisualVS?

在现代软件开发中，代码库的复杂度呈指数级增长。传统的代码阅读方式往往“只见树木，不见森林”。VisualVS 旨在打破这一壁垒：

- **极速洞察**：无需通读数千行代码，一键生成代码拓扑图，秒懂模块间的调用关系。
- **AI 赋能**：利用 LLM 的深度理解能力，精准识别代码语义，生成非简单的 AST 映射，而是具备逻辑意义的拓扑。

## 🚀 核心功能

- **Plugin Pipeline 架构**：采用高度解耦的插件流水线模式，支持 AST 解析、AI 生成、Memgraph 存储、图形拉取等全流程自动化。
- **高性能图数据库**：基于 Memgraph/orb 构建，支持数千个节点的高流畅度交互，体验丝滑。
- **K8s 联动能力**：内置对 Kubernetes 环境的适配，支持分布式系统的拓扑分析与展示。
- **全自动模式 (Auto Mode)**：切换文件时自动触发分析，让您的开发体验无感且高效。
- **Cypher 控制台**：AI 生成的 Cypher 查询即时可见，支持手动微调并重新拉取。

## 🛠️ 安装与配置

1. **依赖准备**：
   - 确保本地或远程已启动 **Memgraph** 实例（建议端口 37788）。
   - 准备好您的 **LLM API Key** (OpenAI 或 兼容接口)。
2. **扩展安装**：
   - 从 VS Code Marketplace 搜索 `VisualVS` 或手动安装 `.vsix` 文件。
3. **配置参数**：
   - 在 VS Code 设置中配置 `ai.apiKey`, `ai.endpoint`, `memgraph.host` 等参数。

---

## ⚡ 快速上手 — 必读配置指南

> **本节是最关键的设置步骤，请务必完整阅读以确保无障碍使用。**

### 第一步：选择 Memgraph 连接模式

VisualVS 支持两种连接方式，在 VS Code 设置中选择其一：

#### 方式 A：Direct 模式 (推荐本地环境)

适合在本地 Docker 或任意主机上运行 Memgraph 的场景。

```bash
# 用 Docker 在本地快速启动 Memgraph（映射到 37788 端口）
docker run -p 37788:7687 memgraph/memgraph:latest
```

然后在 VS Code 设置中（`Ctrl+,` → 搜索 `VisualVS`）填写：

| 设置项 | 值 |
|---|---|
| `visualvs.memgraph.connectionMode` | `direct` |
| `visualvs.memgraph.host` | `localhost` |
| `visualvs.memgraph.port` | `37788` |

---

#### 方式 B：K8s 模式 (自动部署与转发)

如果你已有 Kubernetes 集群且 `kubectl` 已正确配置，VisualVS 会**自动**部署 Memgraph 实例并建立端口转发。

在 VS Code 设置中填写：

| 设置项 | 值 |
|---|---|
| `visualvs.memgraph.connectionMode` | `k8s` |
| `visualvs.memgraph.podSelector` | `app=memgraph`（默认） |
| `visualvs.memgraph.namespace` | 你的 K8s 命名空间（留空则使用 `default`） |
| `visualvs.memgraph.port` | `37788` |

---

### 第二步：配置 AI 服务 (NVIDIA / OpenAI / Ollama)

在 VS Code 设置（`Ctrl+,` → 搜索 `VisualVS`）中填写以下参数。**注意：所有的 Endpoint 必须包含完整的 `/v1/chat/completions` 后缀。**

#### 🟢 方案 1：使用 NVIDIA NIM (强烈推荐)
NVIDIA 提供的模型处理代码逻辑极快且精准。

| 设置项 | 值 |
|---|---|
| `visualvs.ai.endpoint` | `https://integrate.api.nvidia.com/v1/chat/completions` |
| `visualvs.ai.apiKey` | `nvapi-xxxx...` (从 build.nvidia.com 免费获取) |
| `visualvs.ai.model` | `meta/llama-3.1-405b-instruct` (或其它 NIM 模型) |

#### 🔵 方案 2：使用标准 OpenAI
| 设置项 | 值 |
|---|---|
| `visualvs.ai.endpoint` | `https://api.openai.com/v1/chat/completions` |
| `visualvs.ai.apiKey` | `sk-xxxx...` |
| `visualvs.ai.model` | `gpt-4o` 或 `gpt-4-turbo` |

#### ⚪ 方案 3：使用本地 Ollama
| 设置项 | 值 |
|---|---|
| `visualvs.ai.endpoint` | `http://localhost:11434/v1/chat/completions` |
| `visualvs.ai.apiKey` | `ollama` (任意非空字符串) |
| `visualvs.ai.model` | `llama3` 或 `codellama` |

---

### 第三步：开始分析

1. 打开任意源代码文件
2. 在 VS Code 右侧辅助侧边栏找到 **VVS** 图标并点击打开
3. 点击 **Analyze** 按钮
4. 在 **Graph View** 中浏览拓扑图

---

## 🛡️ 许可证

本项目采用 **Apache License 2.0** 开源协议。

---

> **Design Philosophy**: Build the simplest system that survives reality.
