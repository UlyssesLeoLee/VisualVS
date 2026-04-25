# VisualVS - AI-Driven Code Topology & Insight Visualizer

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE.txt)
[![VisualVS Version](https://img.shields.io/badge/version-0.4.15-blueviolet.svg)](package.json)

**VisualVS** 是一款专为架构师和高级开发人员打造照的 VS Code 深度洞察工具。它将 **LLM (大语言模型)**、**LangChain** 和 **Memgraph 属性图数据库** 完美融合，通过高颜值的霓虹风格拓扑图，将枯燥的代码逻辑转化为可感知的视觉资产。

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

## 🛡️ 许可证

本项目采用 **Apache License 2.0** 开源协议。

---

> **Design Philosophy**: Build the simplest system that survives reality.