# VisualVS - AI 代码拓扑可视化工具

VisualVS 是一款为开发者打造的高性能、高颜值的 VS Code 插件，旨在通过 AI 与 图图形数据库（Memgraph）技术，将复杂的代码逻辑转化为直观的拓扑图。

## 🌟 核心功能

- **AI 智能识别**: 自动分析当前代码中的函数调用流（Function Call Graph）。
- **K8s 自动化连接**: 无需手动配置，插件通过 `kubectl` 自动打通本地 Memgraph 集群连接。
- **高端视觉呈现**: 基于 @memgraph/orb 构建的“矢量场”霓虹风格拓扑视图。
- **层级化布局**: 采用逻辑清晰的层次化布局（Hierarchical Layout），完美展示代码调用深度。

## 🛠️ 快速开始

1. **环境准备**: 确保本地已安装 `kubectl` 并可以访问您的 K8s 集群。
2. **AI 配置**: 在 VS Code 设置中填写您的 AI API 端点 (Endpoint) 和 密钥 (API Key)。
3. **一键生成**: 打开源码文件，运行 `VisualVS: Visualize Current Code Flow` 命令。

## ⚙️ 配置项

- `visualvs.ai.endpoint`: AI 服务地址。
- `visualvs.ai.apiKey`: AI 访问密钥。
- `visualvs.memgraph.podSelector`: 用于连接的 K8s Pod 选择器 (默认 `app=memgraph`)。

## 📄 许可证

本项目基于 **Apache License 2.0** 协议开源。
开源地址: [https://github.com/UlyssesLeoLee/VisualVS](https://github.com/UlyssesLeoLee/VisualVS)

---
Produced by Antigravity AI
