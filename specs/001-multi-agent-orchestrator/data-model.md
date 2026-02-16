# 数据模型：多层级 Agent 循环器

**日期**: 2026-02-15
**功能**: 001-multi-agent-orchestrator
**阶段**: Phase 1 - 设计与契约

## 核心实体

### 1. Task（任务）

任务是系统的核心实体，代表用户提交的工作单元。

```typescript
interface Task {
  // 基本信息
  id: string // UUID，任务唯一标识
  description: string // 任务描述
  // ~~type: TaskType~~ // ~~任务类型~~（已移除：任务类型分类功能已删除）
  status: TaskStatus // 当前状态

  // Agent 信息
  assignedAgent?: string // 分配的 Agent ID
  agentMetadata?: Record<string, any> // Agent 特定元数据

  // 层级关系
  parentTaskId?: string // 父任务 ID（用于下游任务）
  childTaskIds: string[] // 子任务 ID 列表
  depth: number // 任务深度（0 为根任务）

  // 时间信息
  createdAt: number // 创建时间戳（毫秒）
  updatedAt: number // 更新时间戳（毫秒）
  startedAt?: number // 开始执行时间戳
  completedAt?: number // 完成时间戳

  // 配置
  timeout: number // 超时时间（毫秒），默认 30 分钟
  maxRetries: number // 最大重试次数，默认 3
  retryCount: number // 当前重试次数

  // 元数据
  metadata: Record<string, any> // 自定义元数据
  tags: string[] // 标签
}

// 任务状态
type TaskStatus
  = | 'pending' // 等待执行
    | 'running' // 执行中
    | 'waiting_user' // 等待用户输入
    | 'waiting_eval' // 等待 AI Agent 评分
    | 'completed' // 已完成
    | 'failed' // 失败
    | 'cancelled' // 已取消
```

**执行模型：事件驱动的状态机步进**

Task 的状态转换采用**持久化状态机步进**模型（非长驻协程）：

1. **加载状态**：从 unstorage 读取任务当前状态和上下文
2. **执行到决策点**：运行当前步骤逻辑，直到遇到决策点（需要评分、用户输入、子任务委派等）
3. **持久化状态**：将更新后的状态写回 unstorage
4. **结束当前步骤**：退出处理函数

外部事件（评分完成、用户响应、子任务返回）通过 hookable 事件触发下一步执行。这确保系统在任意时刻崩溃后可从最后持久化状态恢复。

### 2. TaskResult（任务结果）

任务执行的结果。

```typescript
interface TaskResult {
  taskId: string // 任务 ID
  success: boolean // 是否成功
  output?: any // 输出结果
  error?: TaskError // 错误信息
  duration: number // 执行时长（毫秒）
  metadata: Record<string, any> // 结果元数据
}

interface TaskError {
  code: string // 错误代码
  message: string // 错误消息
  stack?: string // 错误堆栈
  recoverable: boolean // 是否可恢复
}
```

### 3. Score（评分）

任务结果的评估。

```typescript
interface Score {
  // 基本信息
  id: string // UUID，评分唯一标识
  taskId: string // 任务 ID

  // 评分结果
  result: ScoreResult // 评分结果
  confidence: number // 置信度（0-1）
  feedback: string // 反馈内容

  // 评分详情
  criteria: ScoreCriterion[] // 评分标准
  suggestions: string[] // 改进建议

  // 评分者信息
  scorerId: string // 评分者 ID（即 scorer.agentId）
  scorerType: 'agent' // 评分类型（仅支持 AI Agent 评分）

  // 时间信息
  scoredAt: number // 评分时间戳

  // 元数据
  metadata: Record<string, any> // 评分元数据
}

// 评分结果
type ScoreResult
  = | 'pass' // 通过
    | 'reject' // 驳回

// 评分标准
interface ScoreCriterion {
  name: string // 标准名称
  weight: number // 权重（0-1）
  passed: boolean // 是否通过
  reason: string // 原因
}
```

### 4. Mediation（调节）

调节者的介入记录。

```typescript
interface Mediation {
  // 基本信息
  id: string // UUID，调节唯一标识
  taskId: string // 任务 ID

  // 问题诊断
  diagnosis: Diagnosis // 诊断结果

  // 解决方案
  solutions: Solution[] // 解决方案列表
  appliedSolution?: Solution // 应用的解决方案

  // 调节结果
  result: MediationResult // 调节结果
  outcome?: string // 结果描述

  // 调节者信息
  mediatorId: string // 调节者 ID
  mediatorType: 'cbr' | 'rule' | 'manual' // 调节类型

  // 时间信息
  triggeredAt: number // 触发时间戳
  completedAt?: number // 完成时间戳

  // 元数据
  metadata: Record<string, any> // 调节元数据
}

// 诊断结果
interface Diagnosis {
  problemType: ProblemType // 问题类型
  symptoms: string[] // 症状列表
  rootCause?: string // 根本原因
  context: Record<string, any> // 上下文信息
}

// 问题类型
type ProblemType
  = | 'loop' // 循环问题（多次驳回）
    | 'timeout' // 超时问题
    | 'error' // 错误问题
    | 'dependency' // 依赖问题
    | 'unknown' // 未知问题

// 解决方案
interface Solution {
  type: SolutionType // 解决方案类型
  description: string // 描述
  params: Record<string, any> // 参数
  confidence: number // 置信度（0-1）
  estimatedImpact: string // 预期影响
}

// 解决方案类型
type SolutionType
  = | 'retry' // 重试
    | 'reassign' // 重新分配
    | 'split' // 拆分任务
    | 'escalate' // 升级给用户

// 调节结果
type MediationResult
  = | 'success' // 成功
    | 'failed' // 失败
    | 'escalated' // 已升级
```

### 5. TaskHistory（任务历史）

任务的完整执行历史。

```typescript
interface TaskHistory {
  taskId: string // 任务 ID
  events: TaskEvent[] // 事件列表
  scores: Score[] // 评分列表
  mediations: Mediation[] // 调节列表
  statistics: TaskStatistics // 统计信息
}

// 任务事件
type TaskEvent
  = | { type: 'created', timestamp: number, data: CreateTaskData }
    | { type: 'assigned', timestamp: number, agentId: string }
    | { type: 'started', timestamp: number }
    | { type: 'scored', timestamp: number, scoreId: string }
    | { type: 'mediated', timestamp: number, mediationId: string }
    | { type: 'user_query', timestamp: number, queryId: string }
    | { type: 'user_response', timestamp: number, response: string }
    | { type: 'completed', timestamp: number, result: TaskResult }
    | { type: 'failed', timestamp: number, error: TaskError }
    | { type: 'cancelled', timestamp: number, reason: string }
    | { type: 'retried', timestamp: number, attempt: number }
    | { type: 'session_bound', timestamp: number, sessionId: string }
    | { type: 'session_disconnected', timestamp: number, sessionId: string }
    | { type: 'session_reconnected', timestamp: number, sessionId: string }

// 创建任务数据
interface CreateTaskData {
  description: string
  // ~~type: TaskType~~（已移除）
  parentTaskId?: string
  metadata?: Record<string, any>
}

// 任务统计
interface TaskStatistics {
  totalDuration: number // 总时长（毫秒）
  executionDuration: number // 执行时长（毫秒）
  waitingDuration: number // 等待时长（毫秒）
  retryCount: number // 重试次数
  scoreCount: number // 评分次数
  mediationCount: number // 调节次数
}
```

### 6. UserQuery（用户询问）

需要用户决策的问题。

```typescript
interface UserQuery {
  // 基本信息
  id: string // UUID，询问唯一标识
  taskId: string // 任务 ID

  // 问题内容
  question: string // 问题描述
  context?: string // 上下文说明
  options: QueryOption[] // 可选项

  // 响应信息
  response?: string // 用户响应
  selectedOption?: string // 选中的选项 ID
  respondedAt?: number // 响应时间戳

  // 等待策略
  waitIndefinitely: true // 无限期等待用户响应
  reminderInterval: number // 提醒间隔（毫秒），默认 24 小时

  // 时间信息
  createdAt: number // 创建时间戳

  // 元数据
  metadata: Record<string, any> // 询问元数据
}

// 询问选项
interface QueryOption {
  id: string // 选项 ID
  label: string // 选项标签
  description?: string // 选项描述
  value: any // 选项值
}
```

### 7. Agent（代理）

执行任务的智能体。编排器（Orchestrator）管理任务状态和 Agent 调度（in-process）。Agent 执行采用平台委派模型：executor 构建 prompt 写入文件后通过平台适配器（cursor/claude CLI）启动外部 AI 会话，外部 agent 通过 CLI 命令与编排器交互。

```typescript
interface Agent {
  // 基本信息
  id: string // Agent ID
  name: string // Agent 名称
  type: string // Agent 类型

  // 能力描述
  capabilities: string[] // 能力列表
  specialties: string[] // 专长领域

  // 状态信息
  status: AgentStatus // 当前状态
  currentTaskId?: string // 当前任务 ID

  // 配置
  config: AgentConfig // Agent 配置

  // 统计信息
  statistics: AgentStatistics // 统计信息

  // 元数据
  metadata: Record<string, any> // Agent 元数据
}

// Agent 状态
type AgentStatus
  = | 'idle' // 空闲
    | 'busy' // 忙碌
    | 'offline' // 离线

// Agent 配置
interface AgentConfig {
  maxConcurrentTasks: number // 最大并发任务数
  timeout: number // 超时时间（毫秒）
  retryStrategy: RetryStrategy // 重试策略
}

// 重试策略
interface RetryStrategy {
  maxRetries: number // 最大重试次数
  backoff: 'linear' | 'exponential' // 退避策略
  initialDelay: number // 初始延迟（毫秒）
  maxDelay: number // 最大延迟（毫秒）
}

// Agent 统计
interface AgentStatistics {
  totalTasks: number // 总任务数
  completedTasks: number // 完成任务数
  failedTasks: number // 失败任务数
  averageDuration: number // 平均时长（毫秒）
  successRate: number // 成功率（0-1）
}
```

### 8. SessionBinding（会话绑定）

AI 会话与任务的绑定关系，用于支持会话生命周期管理和断线重连。

```typescript
interface SessionBinding {
  // 基本信息
  sessionId: string // 会话唯一标识
  taskId: string // 绑定的任务 ID

  // 状态信息
  status: SessionStatus // 会话状态
  pollInterval: number // 轮询间隔（毫秒），默认 10000

  // 时间信息
  boundAt: number // 绑定时间戳
  lastActiveAt: number // 最后活跃时间戳
  disconnectedAt?: number // 断开时间戳

  // 元数据
  metadata: Record<string, any> // 会话元数据
}

// 会话状态
type SessionStatus
  = | 'active' // 活跃
    | 'disconnected' // 已断开（任务继续后台运行）
    | 'reconnected' // 已重连
    | 'closed' // 已关闭（任务完成后自动关闭）
```

## 关系图

```
Task (1) ──> (0..n) Task (父子关系)
Task (1) ──> (0..n) Score (评分历史)
Task (1) ──> (0..n) Mediation (调节历史)
Task (1) ──> (0..1) UserQuery (用户询问)
Task (1) ──> (1) TaskHistory (任务历史)
Task (1) ──> (0..1) SessionBinding (会话绑定)
Task (n) ──> (1) Agent (分配关系)
```

## 存储结构

### unstorage 键命名规范

```
tasks:{task-id}                    # 任务状态
history:{task-id}                  # 任务历史
scores:{task-id}:{score-id}        # 评分记录
mediations:{task-id}:{mediation-id} # 调节记录
queries:{task-id}:{query-id}       # 用户询问
agents:{agent-id}                  # Agent 信息
sessions:{session-id}              # 会话绑定

# 索引
index:status:{status}              # 按状态索引任务
index:agent:{agent-id}             # 按 Agent 索引任务
index:parent:{parent-id}           # 按父任务索引子任务
index:session:{session-id}         # 按会话索引任务
```

### 示例数据

```typescript
// 任务示例
const task: Task = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  description: '创建用户认证模块',
  type: 'local',
  status: 'running',
  assignedAgent: 'agent-dev-001',
  parentTaskId: undefined,
  childTaskIds: [],
  depth: 0,
  createdAt: 1708012800000,
  updatedAt: 1708012900000,
  startedAt: 1708012850000,
  timeout: 1800000, // 30 分钟
  maxRetries: 3,
  retryCount: 0,
  metadata: {
    priority: 'high',
    requester: 'user-001'
  },
  tags: ['auth', 'backend']
}

// 评分示例（AI Agent 评分）
const score: Score = {
  id: '660e8400-e29b-41d4-a716-446655440001',
  taskId: '550e8400-e29b-41d4-a716-446655440000',
  result: 'pass',
  confidence: 1,
  feedback: '代码质量良好，测试覆盖率达标，文档完整',
  criteria: [], // AI Agent 评分不使用加权标准
  suggestions: [],
  scorerId: 'scorer', // 对应 agentic.config.ts 中 scorer.agentId
  scorerType: 'agent',
  scoredAt: 1708013000000,
  metadata: {}
}

// 调节示例
const mediation: Mediation = {
  id: '770e8400-e29b-41d4-a716-446655440002',
  taskId: '550e8400-e29b-41d4-a716-446655440000',
  diagnosis: {
    problemType: 'loop',
    symptoms: ['连续 3 次驳回', '相同错误重复出现'],
    rootCause: 'Agent 缺少必要的上下文信息',
    context: {
      retryCount: 3,
      lastError: 'Missing authentication configuration'
    }
  },
  solutions: [
    {
      type: 'reassign',
      description: '重新分配给更有经验的 Agent',
      params: { targetAgent: 'agent-senior-001' },
      confidence: 0.8,
      estimatedImpact: '预计成功率提升 40%'
    }
  ],
  appliedSolution: {
    type: 'reassign',
    description: '重新分配给更有经验的 Agent',
    params: { targetAgent: 'agent-senior-001' },
    confidence: 0.8,
    estimatedImpact: '预计成功率提升 40%'
  },
  result: 'success',
  outcome: '任务重新分配后成功完成',
  mediatorId: 'mediator-001',
  mediatorType: 'cbr',
  triggeredAt: 1708013100000,
  completedAt: 1708013200000,
  metadata: {}
}
```

## 数据验证

### Zod Schema

```typescript
import { z } from 'zod'

// 任务 Schema
export const TaskSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(1000),
  type: z.enum(['local', 'downstream', 'inquiry']),
  status: z.enum(['pending', 'running', 'waiting_user', 'waiting_eval', 'completed', 'failed', 'cancelled']),
  assignedAgent: z.string().optional(),
  agentMetadata: z.record(z.any()).optional(),
  parentTaskId: z.string().uuid().optional(),
  childTaskIds: z.array(z.string().uuid()),
  depth: z.number().int().min(0).max(10),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  startedAt: z.number().int().positive().optional(),
  completedAt: z.number().int().positive().optional(),
  timeout: z.number().int().positive(),
  maxRetries: z.number().int().min(0).max(10),
  retryCount: z.number().int().min(0),
  metadata: z.record(z.any()),
  tags: z.array(z.string())
})

// 评分 Schema
export const ScoreSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  result: z.enum(['pass', 'reject']),
  confidence: z.number().min(0).max(1),
  feedback: z.string(),
  criteria: z.array(z.object({
    name: z.string(),
    weight: z.number().min(0).max(1),
    passed: z.boolean(),
    reason: z.string()
  })),
  suggestions: z.array(z.string()),
  scorerId: z.string(),
  scorerType: z.enum(['agent']),
  scoredAt: z.number().int().positive(),
  metadata: z.record(z.any())
})

// 调节 Schema
export const MediationSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  diagnosis: z.object({
    problemType: z.enum(['loop', 'timeout', 'error', 'dependency', 'unknown']),
    symptoms: z.array(z.string()),
    rootCause: z.string().optional(),
    context: z.record(z.any())
  }),
  solutions: z.array(z.object({
    type: z.enum(['retry', 'reassign', 'split', 'escalate']),
    description: z.string(),
    params: z.record(z.any()),
    confidence: z.number().min(0).max(1),
    estimatedImpact: z.string()
  })),
  appliedSolution: z.object({
    type: z.enum(['retry', 'reassign', 'split', 'escalate']),
    description: z.string(),
    params: z.record(z.any()),
    confidence: z.number().min(0).max(1),
    estimatedImpact: z.string()
  }).optional(),
  result: z.enum(['success', 'failed', 'escalated']),
  outcome: z.string().optional(),
  mediatorId: z.string(),
  mediatorType: z.enum(['cbr', 'rule', 'manual']),
  triggeredAt: z.number().int().positive(),
  completedAt: z.number().int().positive().optional(),
  metadata: z.record(z.any())
})
```

## 迁移策略

### 版本 1.0.0 → 1.1.0

如果未来需要添加新字段，使用以下策略：

1. **向后兼容**：新字段设为可选
2. **默认值**：提供合理的默认值
3. **迁移脚本**：自动填充旧数据的新字段

```typescript
// 迁移示例
async function migrateTasksV1ToV2(storage: Storage) {
  const keys = await storage.getKeys('tasks:')
  for (const key of keys) {
    const task = await storage.getItem<Task>(key)
    if (task && !task.tags) {
      task.tags = [] // 添加默认值
      await storage.setItem(key, task)
    }
  }
}
```
