# VisualVS - AI-Driven Code Topology & Insight Visualizer

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE.txt)
[![VisualVS Version](https://img.shields.io/badge/version-0.4.4-blueviolet.svg)](package.json)

**VisualVS** 是一款专为架构师和高级开发人员打造的 VS Code 深度洞察工具。它将 **LLM (大语言模型)**、**LangChain** 与 **Memgraph 属性图数据库** 完美融合，通过高颜值的霓虹风格拓扑图，将枯燥的代码逻辑转化为可感知的视觉资产。

---

## 💎 为什么选择 VisualVS?

在处理大规模遗留代码或复杂的分布式系统时，静态的文本阅读往往难以捕捉全局的“拓扑感”。VisualVS 致力于解决：
- **逻辑迷雾**: 快速理清数千行代码中的核心调用链路。
- **架构一致性**: 实时对比设计预想与实际代码拓扑的差异。
- **快速上手**: 新成员通过图谱即可秒懂模块间的协作关系。

## ✨ 核心特性

- **🧬 智能拓扑建模**: 基于 LangChain 优化的推理管道，精准提取函数调用链（Call Graph）、类依赖及变量流向。
- **🕸️ 高性能图引擎**: 采用 @memgraph/orb 驱动，支持数千个节点的流畅交互，具备“矢量场”般的动态缩放与居中体验。
- **🔗 零配置 K8s 联动**: 内置自动化的端口转发与 Pod 探测机制，可秒级打通本地 VS Code 与云端/本地 K8s 集群中的 Memgraph 数据库。
- **🎨 智能色彩系统**: 基于哈希算法的随机色彩分配，确保图谱视图 (Graph) 与 数据列表 (Text Data) 之间的颜色一一对应，大幅提升识别效率。
- **⌨️ 交互式 Cypher 实验室**: 提供实时的 Cypher 编辑器，支持 AI 建议查询自动回填，允许用户通过原生图查询语言深度探索代码资产。

## 🚀 快速开始

### 1. 准备环境
- 确保您的 K8s 集群中运行着 Memgraph（默认 Pod 标签 `app=memgraph`）。
- 或者本地运行 Memgraph 实例。

### 2. 配置扩展
在 VS Code 设置中配置您的 AI 引擎：
- `visualvs.ai.endpoint`: 支持 OpenAI 兼容格式的 API 地址。
- `visualvs.ai.apiKey`: 您的 API 访问密钥。
- `visualvs.ai.model`: 推荐使用 `gpt-4` 或 `gemini-1.5-pro` 等高推理能力模型。

### 3. 一键可视化
- 打开任何源码文件（支持 TS, JS, Go, Python, Java 等）。
- 点击底部状态栏图标或运行 `VisualVS: Visualize Current Code Flow` 命令。
- 观察左侧 Pipeline Log 实时流出的 AI “思考过程”。

## 🏗️ 技术架构 (Plugin Pipeline Pattern)

VisualVS 遵循严格的“插件管道模式”设计，确保系统的原子性与可扩展性：
1. **Pre-flight**: 环境自检（K8s 连接、Memgraph 状态探测）。
2. **AI Analysis**: 基于 LangChain 的结构化 JSON 提取，生成 MERGE 风格的 Cypher 语句。
3. **Ingestion**: 幂等写入 Memgraph 数据库，确保图谱不重复、不冲突。
4. **Rendering**: 将图数据推送至 Webview，执行层级布局 (Dagre) 并进行可视化渲染。

## 📄 许可证

本项目基于 **Apache License 2.0** 协议开源。
更多详情请访问 [GitHub 仓库](https://github.com/UlyssesLeoLee/VisualVS)。

---
*Developed with ❤️ by Antigravity AI — Designing systems that remain correct as the world changes.*
