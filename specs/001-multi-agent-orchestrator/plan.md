# 实现计划：多层级 Agent 循环器

**分支**: `001-multi-agent-orchestrator` | **日期**: 2026-02-15 | **规格**: [spec.md](./spec.md)
**输入**: 功能规格来自 `/specs/001-multi-agent-orchestrator/spec.md`

**注意**: 本模板由 `/speckit.plan` 命令填写。执行工作流见 `.specify/templates/commands/plan.md`。

## 摘要

实现一个多层级 Agent 循环器系统，支持任务的自动调度、评分、调节和用户交互。系统采用 UnJS 生态构建，使用 citty 提供 CLI 接口，unstorage 实现任务状态持久化，c12 管理配置。核心功能包括：任务类型判断、Agent 分配、评分循环、调节者介入和进度监控。

## 技术上下文

**语言/版本**: TypeScript 5.x + Node.js (ESM)
**主要依赖**:
- citty (CLI 框架)
- unstorage (任务状态持久化)
- c12 (配置加载)
- hookable (事件钩子系统)
- pathe (跨平台路径处理)
- consola (日志输出，仅控制台人类可读格式)
- zod (数据验证，用于 Task/Score/Mediation 等实体的 schema 验证)
- @clack/prompts (交互式 CLI 提示，用于 init 命令)

**存储**: unstorage (文件系统驱动) - 任务状态、历史记录、评分记录
**测试**: Vitest (单元测试 + 集成测试)
**目标平台**: Node.js 18+ (跨平台：Windows/Linux/macOS)
**项目类型**: 单项目 (CLI 工具 + 库)
**性能目标**:
- 任务启动响应 < 30 秒
- 任务类型判断 < 5 秒
- 状态查询响应 < 2 秒
- 支持 5 个并发任务，单任务延迟增加不超过 50%

**约束**:
- 任务处理超时 30 分钟
- 评分循环最大重试 3 次
- 任务历史保留 30 天
- 内存占用 < 500MB (5 个并发任务)
- 5 个并发任务下单任务操作延迟增加不超过 50%
- 可观测性限于 consola 控制台日志（人类可读），不引入结构化日志或指标收集
- 编排器（Orchestrator）in-process 管理任务状态和调度。Agent 执行采用平台委派模型：executor 构建 prompt 写入文件，通过平台适配器（cursor/claude CLI）启动外部 AI 会话，外部 agent 通过 CLI 命令交互

**规模/范围**:
- 支持 10+ 种 Agent 类型
- 单个任务最多 10 层嵌套
- 任务历史记录 1000+ 条

## 宪法检查

*门禁：Phase 0 研究前必须通过。Phase 1 设计后重新检查。*

### 原则 I：库优先（Library-First）
✅ **通过** - 核心功能实现为独立模块：
- `src/orchestrator/` - 循环器核心逻辑（含 SessionBinding 会话绑定管理）
- `src/scorer/` - 评分系统（仅 AI Agent 评分，通过 `scorer.agentId` 配置启用）
- `src/mediator/` - 调节者（CBR 案例推理 + 规则引擎）
- `src/task/` - 任务管理（含子任务委派，最大深度 10）
- 每个模块可独立测试和文档化

### 原则 II：CLI 接口
✅ **通过** - 所有功能通过 `agentic` CLI 暴露：
- `/agentic.specify <task>` - 创建任务并在 AI 会话中维持持续连接（自动轮询进度）
- `/agentic.status [task-id]` - 查看任务状态或列出活跃任务（`--watch` 启动永久监控）
- `agentic wait <task-id>` - 阻塞等待直到终态或 waiting_user
- `agentic complete <task-id>` - 子 Agent 报告任务完成
- `agentic score <task-id>` - Scorer Agent 报告评分结果
- `agentic respond <task-id>` - 用户响应 waiting_user 查询
- `agentic subtask <parent-id> <agent-id> "desc"` - 创建子任务
- `agentic ask <task-id> --question "..."` - Agent 提问（转 waiting_user）
- `/agentic.cancel <task-id>` - 取消任务
- `/agentic.init` - 初始化配置
- 支持 JSON 和人类可读输出格式
- 任务后台执行，不受会话生命周期影响

### 原则 III：测试优先（不可协商）
✅ **通过** - 采用 TDD 方法：
- 每个模块先写测试
- 使用 Vitest 进行单元和集成测试
- 关键路径遵循 Red-Green-Refactor
- 目标覆盖率 > 80%

### 原则 IV：配置驱动（Config-Driven）
✅ **通过** - 所有行为可配置：
- `agentic.config.ts` 定义配置结构
- 使用 c12 加载配置
- 支持环境变量覆盖
- 无硬编码默认值

### 原则 V：简洁与 YAGNI
✅ **通过** - 采用 UnJS 生态：
- citty (CLI)
- unstorage (存储)
- c12 (配置)
- hookable (事件)
- 避免过度抽象，从简单开始
- 编排器 in-process 管理状态，Agent 执行通过平台委派（cursor/claude CLI），采用持久化状态机模型

## 项目结构

### 文档（本功能）

```text
specs/001-multi-agent-orchestrator/
├── plan.md              # 本文件 (/speckit.plan 命令输出)
├── research.md          # Phase 0 输出 (/speckit.plan 命令)
├── data-model.md        # Phase 1 输出 (/speckit.plan 命令)
├── quickstart.md        # Phase 1 输出 (/speckit.plan 命令)
├── contracts/           # Phase 1 输出 (/speckit.plan 命令)
│   ├── task-api.json    # 任务 API 契约
│   ├── scorer-api.json  # 评分 API 契约
│   └── mediator-api.json # 调节 API 契约
└── tasks.md             # Phase 2 输出 (/speckit.tasks 命令 - 不由 /speckit.plan 创建)
```

### 源代码（仓库根目录）

```text
src/
├── orchestrator/        # 循环器核心
│   ├── index.ts        # Orchestrator 类（任务提交、处理、队列管理、agent 选择、会话管理）
│   └── types.ts        # 类型定义
│
├── task/               # 任务管理
│   ├── index.ts        # 任务管理器
│   ├── manager.ts      # 任务生命周期
│   ├── ask.ts          # 用户询问管理（AskManager）
│   ├── queue.ts        # 任务队列
│   └── types.ts        # 任务类型定义
│
├── scorer/             # 评分系统
│   ├── index.ts        # 评分器入口
│   ├── evaluator.ts    # 评分逻辑（buildAgentScore）
│   └── types.ts        # 评分类型
│
├── mediator/           # 调节者
│   ├── index.ts        # 调节器入口
│   ├── analyzer.ts     # 问题分析
│   ├── resolver.ts     # 解决方案生成
│   └── types.ts        # 调节类型
│
├── agents/             # Agent 管理（已存在，扩展）
│   ├── index.ts        # 平台适配器（claude/cursor CLI 后端）
│   ├── loader.ts       # Agent 加载器（JSON + Markdown 格式）
│   ├── registry.ts     # Agent 注册表
│   ├── executor.ts     # Agent 执行器（平台委派模型，prompt 文件写入）
│   ├── prompt-builder.ts # 提示构建器（System/Task/Scorer/Retry prompt）
│   ├── transcript-sync.ts # Transcript 同步工具（Cursor agent-transcripts → 日志）
│   └── types.ts        # Agent 类型
│
├── storage/            # 存储层（已存在，扩展）
│   ├── index.ts        # 存储接口
│   ├── task-store.ts   # 任务存储
│   ├── history-store.ts # 历史记录存储
│   └── types.ts        # 存储类型
│
├── cli/                # CLI 命令（已存在，扩展）
│   ├── index.ts        # CLI 入口
│   ├── helpers.ts      # CLI 上下文初始化（Orchestrator、存储、Agent 加载）
│   ├── commands/       # 命令实现
│   │   ├── specify.ts  # /agentic.specify
│   │   ├── status.ts   # /agentic.status（含 --watch 永久监控）
│   │   ├── wait.ts     # agentic wait（阻塞等待终态）
│   │   ├── complete.ts # agentic complete（子 Agent 报告完成）
│   │   ├── score.ts    # agentic score（Scorer Agent 报告评分）
│   │   ├── respond.ts  # agentic respond（用户响应 waiting_user）
│   │   ├── subtask.ts  # agentic subtask（创建子任务）
│   │   ├── ask.ts      # agentic ask（Agent 提问，转 waiting_user）
│   │   ├── cancel.ts   # /agentic.cancel
│   │   └── init.ts     # /agentic.init
│   └── utils.ts        # CLI 工具函数
│
├── config/             # 配置（已存在，扩展）
│   ├── index.ts        # 配置加载
│   ├── define.ts       # 配置定义
│   └── schema.ts       # 配置 schema
│
├── constants/          # 常量定义
│   └── platforms.ts   # 平台配置（Cursor/Claude 目录和命令映射）
│
└── utils/              # 工具函数（已存在，扩展）
    ├── index.ts        # 工具函数入口
    ├── logger.ts       # 日志工具
    └── validator.ts    # 验证工具

tests/
├── unit/               # 单元测试
│   ├── orchestrator/   # 循环器测试
│   ├── task/           # 任务管理测试
│   ├── scorer/         # 评分系统测试
│   ├── mediator/       # 调节者测试
│   └── agents/         # Agent 测试
│
├── integration/        # 集成测试
│   ├── task-flow.test.ts      # 任务流程测试
│   ├── mediation.test.ts      # 调节测试
│   └── concurrent.test.ts     # 并发测试
│
└── fixtures/           # 测试固件
    ├── agents/         # 测试用 Agent 定义
    ├── tasks/          # 测试用任务
    └── configs/        # 测试用配置
```

**结构决策**: 采用单项目结构（Option 1），因为这是一个 CLI 工具 + 库的组合。所有功能模块都在 `src/` 下，按功能域划分。测试文件在独立的 `tests/` 目录，按测试类型（单元/集成）组织。

## 复杂度跟踪

> **仅在宪法检查有需要说明的违规时填写**

无违规需要说明。所有设计决策符合宪法原则。

---

## Phase 0: 大纲与研究

### 研究任务

1. **任务状态机设计**（已决策：FSM + 事件日志 + 持久化状态机步进）
   - 研究任务生命周期状态转换
   - 调查最佳实践：Temporal、Cadence、Step Functions
   - 决策：FSM + 事件日志混合模式（见 research.md）；执行模型采用持久化状态机步进——每步执行到决策点后持久化状态并结束，事件驱动下一步执行（与 spec.md 假设一致）

2. **Agent 通信协议**
   - 研究 Agent 间通信模式
   - 调查：消息队列 vs 直接调用 vs 事件总线
   - 决策：通信协议和数据格式

3. **评分算法**
   - 研究任务评分方法
   - 调查：规则引擎 vs ML 模型 vs 启发式
   - 决策：仅采用 AI Agent 评分，通过 `scorer.agentId` 配置启用

4. **调节策略**
   - 研究问题诊断和解决方案生成
   - 调查：专家系统 vs 案例推理 vs LLM
   - 决策：调节触发条件和策略

5. **并发控制**（已决策：FIFO 队列 + 并发限制 + 持久化状态机）
   - 研究任务并发执行策略
   - ~~调查：线程池 vs Worker 线程 vs 进程池~~ → 已决策：FIFO 任务队列 + maxConcurrentTasks 并发限制，编排器 in-process 管理，Agent 执行委派给外部平台
   - 决策：采用持久化状态机模型，每步执行到决策点后持久化状态并结束，CLI 命令驱动下一步执行

6. **持久化策略**
   - 研究任务状态持久化方案
   - 调查：unstorage 驱动选择（fs vs redis vs sqlite）
   - 决策：存储结构和索引策略

### 输出

`research.md` 文件，包含：
- 每个研究任务的决策
- 决策理由
- 考虑的替代方案
- 技术选型建议

---

## Phase 1: 设计与契约

### 前置条件
- `research.md` 完成

### 数据模型

生成 `data-model.md`，包含：

1. **Task（任务）**
   - id: string (UUID)
   - description: string
   ~~- type: 'local' | 'downstream' | 'inquiry'~~（已移除：任务类型分类功能已删除）
   - status: 'pending' | 'running' | 'waiting_user' | 'waiting_eval' | 'completed' | 'failed' | 'cancelled'
   - assignedAgent: string
   - parentTaskId?: string
   - childTaskIds: string[]
   - depth: number (0-10)
   - retryCount: number (default 0)
   - maxRetries: number (default 3)
   - score?: { result: 'pass' | 'reject', score?: number, feedback?: string, scoredAt: number }
   - output?: string
   - createdAt: number
   - updatedAt: number
   - metadata: Record<string, any>

2. **Score（评分）**
   - id: string
   - taskId: string
   - result: 'pass' | 'reject'
   - feedback: string
   - scorerId: string
   - scoredAt: number

3. **Mediation（调节）**
   - id: string
   - taskId: string
   - diagnosis: string
   - suggestions: string[]
   - result: 'success' | 'failed' | 'escalated'
   - mediatorId: string
   - mediatedAt: number

4. **TaskHistory（任务历史）**
   - taskId: string
   - events: TaskEvent[]
   - scores: Score[]
   - mediations: Mediation[]

5. **UserQuery（用户询问）**
   - id: string
   - taskId: string
   - question: string
   - options: string[]
   - response?: string
   - respondedAt?: number

### API 契约

生成 `/contracts/` 目录下的 JSON Schema。

> **注意**: 以下契约定义的是 **in-process 编程接口**（函数签名与数据结构），而非 HTTP REST 端点。使用 HTTP 风格表示法（method + path）仅为描述约定，不暗示网络传输。系统采用进程内函数调用通信。

1. **task-api.json** - 任务管理接口
   - createTask - 创建任务
   - getTask - 获取任务状态
   - cancelTask - 取消任务
   - getTaskHistory - 获取任务历史
   - bindSession / unbindSession - 会话绑定/解绑

2. **scorer-api.json** - 评分接口
   - submitScore - 提交评分
   - getScoresByTask - 获取任务评分历史

3. **mediator-api.json** - 调节接口
   - triggerMediation - 触发调节
   - getMediationsByTask - 获取调节记录

### 快速开始指南

生成 `quickstart.md`，包含：
- 安装步骤
- 基本配置
- 第一个任务示例
- 常见问题排查

### Agent 上下文更新

运行 `.specify/scripts/powershell/update-agent-context.ps1 -AgentType cursor-agent`

更新内容：
- 添加新技术栈（citty、unstorage、hookable）
- 添加项目结构说明
- 添加开发指引

### 输出

- `data-model.md` - 完整数据模型
- `/contracts/*.json` - API 契约
- `quickstart.md` - 快速开始指南
- 更新的 agent 上下文文件

---

## Phase 2: 任务分解

**注意**: Phase 2 由 `/speckit.tasks` 命令执行，不在本计划范围内。

Phase 2 将生成 `tasks.md`，包含：
- 按阶段组织的任务列表
- 每个任务的依赖关系
- 可并行执行的任务标记
- 预估工作量

---

## 宪法检查（Phase 1 后）

### 重新评估

Phase 1 设计完成后，重新检查宪法合规性：

✅ **原则 I（库优先）** - 所有模块独立且可测试
✅ **原则 II（CLI 接口）** - 所有功能通过 CLI 暴露
✅ **原则 III（测试优先）** - 测试结构已规划
✅ **原则 IV（配置驱动）** - 配置 schema 已定义
✅ **原则 V（简洁与 YAGNI）** - 使用 UnJS 生态，避免过度设计

**结论**: 设计符合所有宪法原则，可以进入 Phase 2（任务分解）。

---

## 附录

### 技术栈版本

- Node.js: >= 18.0.0
- TypeScript: ^5.0.0
- citty: ^0.2.0
- unstorage: ^1.17.4
- c12: ^3.3.0
- hookable: ^6.0.1
- pathe: ^2.0.3
- consola: ^3.4.2
- zod: ^4.3.6
- vitest: ^4.0.15

### 开发工具

- tsdown: 构建工具
- eslint: 代码检查
- @antfu/eslint-config: ESLint 配置
- bumpp: 版本管理
- simple-git-hooks: Git 钩子

### 参考资料

- [Anthropic 长时间运行 Agent 最佳实践](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Auto-Company 多 Agent 协作模式](https://github.com/MaxMiksa/Auto-Company)
- [UnJS 生态文档](https://unjs.io/)
- [Vitest 文档](https://vitest.dev/)
- [citty CLI 框架](https://github.com/unjs/citty)
- [unstorage 存储抽象](https://github.com/unjs/unstorage)
