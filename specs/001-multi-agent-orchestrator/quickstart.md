# 快速开始：多层级 Agent 循环器

本指南将帮助您快速上手多层级 Agent 循环器系统。

## 前置要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- 支持的 AI Agents 环境（Cursor、Claude Code 等）

## 安装

```bash
# 克隆仓库
git clone https://github.com/hairyf/agentic-x.git
cd agentic-x

# 安装依赖
pnpm install

# 构建项目
pnpm build
```

## 初始化

首次使用前，需要初始化配置：

```bash
# 初始化配置文件和目录结构
agentic init

# 这将创建：
# - agentic.config.ts - 配置文件（项目根目录）
# - .agentic/storage/ - 存储目录（任务状态和历史）
```

> **注意**: Agent 定义存放在 AI Agents 环境的标准目录中（如 `.cursor/agents/`、`.claude/agents/`），而非 `.agentic/` 目录。

## 基本配置

编辑项目根目录的 `agentic.config.ts`：

```typescript
import { defineConfig } from 'agentic-x/config/define'

export default defineConfig({
  // 循环器配置
  orchestrator: {
    maxConcurrentTasks: 5, // 最大并发任务数
    defaultTimeout: 1800000, // 默认超时（30 分钟）
    maxRetries: 3, // 最大重试次数
    pollInterval: 10000, // 进度轮询间隔（毫秒），默认 10 秒
  },

  // 评分配置（配置 agentId 启用 AI Agent 评分，不配置则跳过评分）
  scorer: {
    agentId: 'scorer', // 评分 Agent ID（对应 .cursor/agents/scorer.md 的 name）
  },

  // 调节配置
  mediator: {
    triggerThreshold: 3, // 触发调节的驳回次数
    enableCBR: true, // 启用案例推理
  },

  // 存储配置
  storage: {
    driver: 'fs', // 存储驱动（fs/redis/sqlite）
    basePath: './.agentic/storage',
  },

  // Agent 配置
  agents: {
    directories: ['.cursor/agents/', '.claude/agents/'], // AI Agents 环境目录
    autoLoad: true, // 自动加载 Agent
  },
})
```

## 创建第一个 Agent

在 AI Agents 环境目录下创建 Agent 定义文件（如 `.cursor/agents/developer.json`）：

```json
{
  "id": "agent-dev-001",
  "name": "开发 Agent",
  "type": "developer",
  "capabilities": [
    "code_generation",
    "code_review",
    "testing"
  ],
  "specialties": [
    "typescript",
    "node.js",
    "testing"
  ],
  "config": {
    "maxConcurrentTasks": 2,
    "timeout": 1800000,
    "retryStrategy": {
      "maxRetries": 3,
      "backoff": "exponential",
      "initialDelay": 1000,
      "maxDelay": 60000
    }
  }
}
```

## 创建第一个任务

### 方式 1：使用 CLI 命令

```bash
# 创建任务（需指定 agentId 和任务描述）
agentic specify agent-dev-001 "创建一个用户认证模块"

# 输出示例（JSON）：
# {
#   "taskId": "550e8400-e29b-41d4-a716-446655440000",
#   "status": "running",
#   "assignedAgent": "agent-dev-001",
#   "sessionId": "abc123",
#   "promptFile": ".agentic/prompts/550e8400-...md"
# }

# 阻塞等待任务完成：
agentic wait 550e8400-e29b-41d4-a716-446655440000
```

### 方式 2：在 AI Agents 环境中使用（推荐）

在 Cursor 或 Claude Code 中，执行 `/agentic.specify` 命令。系统自动选择合适的 Agent、提交任务、委派给外部 AI 会话执行，并通过 `agentic wait` 阻塞等待结果：

```
用户: /agentic.specify 创建一个用户认证模块

系统: ✓ 任务已创建并委派给外部 AI 会话
      ID: 550e8400-e29b-41d4-a716-446655440000
      分配给: agent-dev-001 (开发 Agent)
      Prompt 文件: .agentic/prompts/550e8400-...md
      Session ID: abc123

      正在等待任务完成...

系统: [阻塞等待中] 状态: running | 已用时间: 30s
系统: [阻塞等待中] 状态: running | 已用时间: 1m

系统: [阻塞等待中] 状态: waiting_user
      ⚠️ Agent 需要您的输入
      问题: 选择密码哈希算法
      选项:
        1. bcrypt
        2. argon2

用户: agentic respond 550e8400-... --answer "option-bcrypt"

系统: ✓ 已收到响应，继续等待...

系统: [阻塞等待中] 状态: waiting_eval | 评分中...
系统: [阻塞等待中] 状态: running | Scorer 驳回，Agent 重试中 (1/3)...
系统: [阻塞等待中] 状态: waiting_eval | 再次评分中...

系统: ✅ 任务完成
      结果: 已写入 src/auth/ (4 个文件)
      总时长: 1 分 30 秒
      评分: 2 次 (1 驳回 → 1 通过)
```

**关键行为**:
- `agentic specify` 提交任务并返回 JSON（taskId/sessionId/promptFile）
- `agentic wait` 阻塞等待直到终态（completed/failed/cancelled）或 waiting_user
- 外部 Agent 通过 `agentic complete` 报告完成，系统自动启动 Scorer Agent 评分
- 任务在后台运行，不受会话生命周期影响

## 查询任务状态（断线重连）

当你关闭了 AI 会话或会话意外断开时，**任务在后台继续运行**。你可以通过 `/agentic.status` 重新连接：

```
用户: /agentic.status 550e8400-e29b-41d4-a716-446655440000

系统: 任务 ID: 550e8400-e29b-41d4-a716-446655440000
      描述: 创建一个用户认证模块
      状态: running
      分配的 Agent: agent-dev-001
      进度: 60%
      已用时间: 15 分钟
      预计剩余: 10 分钟

      正在恢复轮询...

系统: [20:30:10] ⏳ running | 正在优化代码... | 已用时间: 15m 10s
系统: [20:30:20] ⏳ running | 正在生成文档... | 已用时间: 15m 20s
...
```

### 列出所有活跃任务

```
用户: /agentic.status

系统: 活跃任务 (2 个):
      1. 550e8400-...440000 | running  | 创建一个用户认证模块     | 15m
      2. 660e8400-...440001 | waiting  | 设计数据库 Schema        | 8m (等待用户输入)

      已完成任务 (最近 5 个):
      3. 770e8400-...440002 | completed | 生成 README 文件         | 2m
```

### CLI 模式（终端）

在终端中可以使用 CLI 进行一次性查询或持续监控：

```bash
# 一次性查询
agentic status 550e8400-e29b-41d4-a716-446655440000

# 持续监控（等同于 AI 会话的轮询行为）
agentic status 550e8400-e29b-41d4-a716-446655440000 --watch

# 输出示例：
# [20:30:00] 状态: running | 进度: 60% | 已用时间: 15 分钟
# [20:30:10] 状态: running | 进度: 70% | 已用时间: 16 分钟
# [20:30:20] 状态: completed | 进度: 100% | 总时长: 18 分钟
```

## 查看任务历史

> 任务历史通过 `agentic status <task-id> --history` 查看（history 是 status 的子功能）。

```bash
# 查看任务历史
agentic status 550e8400-e29b-41d4-a716-446655440000 --history

# 输出示例：
# 任务历史
# ├── [20:15:00] 任务创建
# ├── [20:15:05] 分配给 agent-dev-001
# ├── [20:15:10] 开始执行
# ├── [20:25:00] 提交评分 (驳回)
# │   └── 反馈: 缺少单元测试
# ├── [20:25:10] 重新执行
# ├── [20:30:00] 提交评分 (通过)
# └── [20:30:05] 任务完成
#
# 统计信息:
# - 总时长: 18 分钟
# - 执行时长: 16 分钟
# - 等待时长: 2 分钟
# - 重试次数: 1
# - 评分次数: 2
```

## 取消任务

```bash
# 取消任务
agentic cancel 550e8400-e29b-41d4-a716-446655440000 --reason "需求变更"

# 输出示例：
# ✓ 任务已取消
# ID: 550e8400-e29b-41d4-a716-446655440000
# 取消原因: 需求变更
# 取消时间: 2026-02-15 20:35:00
```

## 处理用户询问

当任务需要用户输入时，系统会暂停并发送询问：

```bash
# 系统输出：
# ⚠ 任务需要您的输入
# 任务 ID: 550e8400-e29b-41d4-a716-446655440000
# 问题: 选择数据库类型
# 选项:
#   A. MySQL
#   B. PostgreSQL
#   C. MongoDB
#
# 请输入您的选择 (A/B/C):

# 用户输入：
B

# 系统输出：
# ✓ 已收到您的响应
# 任务继续执行...
```

## 调节者介入

当任务多次驳回时，调节者会自动介入：

```bash
# 系统输出：
# ⚠ 任务已被驳回 3 次，触发调节者介入
# 任务 ID: 550e8400-e29b-41d4-a716-446655440000
#
# 问题诊断:
# - 问题类型: 循环问题
# - 症状: 连续 3 次驳回，相同错误重复出现
# - 根本原因: Agent 缺少必要的上下文信息
#
# 解决方案:
# 1. 重新分配给更有经验的 Agent (置信度: 80%)
# 2. 拆分任务为多个子任务 (置信度: 60%)
#
# 应用解决方案: 重新分配给 agent-senior-001
# ✓ 调节成功，任务继续执行
```

## 常见问题

### 1. 任务一直处于 pending 状态

**原因**: 没有可用的 Agent 或 Agent 都在忙碌

**解决方案**:
```bash
# 检查 Agent 状态（通过 init 命令的诊断输出查看）
agentic init --check

# 如果没有 Agent，在 AI Agents 环境目录下创建 Agent 定义
# 如果 Agent 都在忙碌，等待或增加并发数
```

### 2. 任务执行超时

**原因**: 任务复杂度超出预期或 Agent 性能问题

**解决方案**:
```bash
# 增加超时时间
agentic specify "任务描述" --timeout 3600000  # 60 分钟

# 或在配置文件中修改默认超时
```

### 3. 评分一直驳回

**原因**: 评分标准过于严格或任务描述不清晰

**解决方案**:
```bash
# 查看评分反馈
agentic status <task-id> --history

# 根据反馈调整任务描述或评分标准
# 如果多次驳回，调节者会自动介入
```

### 4. 找不到合适的 Agent

**原因**: 没有定义相应类型的 Agent

**解决方案**:
```bash
# 系统会提示需要创建的 Agent 类型
# 根据提示在 AI Agents 环境目录下创建 Agent 定义
# 例如：.cursor/agents/designer.json 或 .claude/agents/designer.json
```

## 下一步

- 阅读 [数据模型文档](./data-model.md) 了解系统架构
- 阅读 [API 契约](./contracts/) 了解 API 接口
- 查看 [测试指南](../../tests/README.md) 了解如何编写测试
- 参考 [配置文档](../../docs/configuration.md) 了解高级配置

## 获取帮助

```bash
# 查看帮助
agentic --help

# 查看特定命令的帮助
agentic specify --help
agentic status --help
agentic cancel --help
```

## 示例场景

### 场景 1：简单任务（单个 Agent，CLI 模式）

```bash
# 创建任务（指定 agentId）
agentic specify agent-doc-001 "生成一个 README 文件"

# 系统自动：
# 1. 分配给文档 Agent
# 3. 写入 prompt 文件，委派给外部 AI 会话
# 4. Agent 完成后调用 agentic complete
# 5. 配置了 scorer.agentId 时触发 Scorer Agent 评分
# 6. 评分通过后标记为 completed

# 阻塞等待结果
agentic wait <taskId>
```

### 场景 2：在 AI 环境中使用（推荐）

```
用户: /agentic.specify 创建一个带有数据库和 API 的 Web 应用

# 系统自动选择 agent，提交任务并 wait：
# 1. 为每个 agent 专长创建子任务（如需要）
# 3. 各子任务委派给外部 AI 会话
# 4. 子任务各自 complete → score
# 5. 全部完成后聚合结果
```

### 场景 3：需要用户输入的任务

```bash
# Agent 提问时：
agentic ask <taskId> --question "选择技术栈: React 或 Vue?"

# 用户回答：
agentic respond <taskId> --answer "option-react"

# 系统自动恢复任务执行
```

## 性能优化建议

1. **合理设置并发数**: 根据系统资源调整 `maxConcurrentTasks`
2. **使用标签分类**: 为任务添加标签，便于查询和管理
3. **定期清理历史**: 删除 30 天前的任务历史
4. **监控 Agent 性能**: 定期查看 Agent 统计信息，优化配置

```bash
# 查看任务统计（通过 status 命令的详情输出）
agentic status <task-id> --history

# 历史输出包含统计信息：总时长、执行时长、等待时长、重试次数、评分次数
```
