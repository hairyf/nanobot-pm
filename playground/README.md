# Playground

agentic-x 的本地沙盒环境，用于试验多智能体编排与任务流程。

## 依赖

- [agentic-x](https://github.com/hairyf/agentic-x)（workspace 包）

## 使用

在仓库根目录安装依赖后，可在本目录下使用 agentic CLI：

```bash
pnpm agentic specify "任务描述"
pnpm agentic status
```

任务与历史会写入 `.agentic/storage/`。
