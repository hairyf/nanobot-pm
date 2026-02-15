# 研究报告：多层级 Agent 循环器

**日期**: 2026-02-15
**功能**: 001-multi-agent-orchestrator
**阶段**: Phase 0 - 大纲与研究

## 研究任务 1：任务状态机设计

### 决策
采用 **有限状态机（FSM）+ 事件日志** 的混合模式。

### 理由
1. **FSM 优势**：
   - 状态转换清晰，易于理解和调试
   - 可以在编译时检查状态转换的合法性
   - 适合任务生命周期管理

2. **事件日志优势**：
   - 完整记录任务历史，支持审计和回溯
   - 支持调节者分析问题时查看完整上下文
   - 便于实现任务恢复和重试

3. **混合模式**：
   - FSM 管理当前状态和合法转换
   - 事件日志记录所有状态变更和操作
   - 两者结合提供最佳的可维护性和可追溯性

### 状态转换图

```
pending → running → completed
   ↓         ↓         ↑
   ↓    waiting_user  ↑
   ↓         ↓         ↑
   ↓    running -------↑
   ↓         ↓
   ↓    failed
   ↓         ↓
   → cancelled ←-------
```

### 考虑的替代方案

1. **纯 Event Sourcing**
   - 优点：完整的事件历史，易于重放
   - 缺点：查询当前状态需要重放事件，性能开销大
   - 拒绝理由：对于任务管理场景，查询当前状态是高频操作

2. **纯 FSM**
   - 优点：简单直接，性能好
   - 缺点：缺少历史记录，难以分析问题
   - 拒绝理由：调节者需要完整的任务历史来诊断问题

3. **Temporal/Cadence 工作流引擎**
   - 优点：成熟的分布式工作流解决方案
   - 缺点：引入额外依赖，增加系统复杂度
   - 拒绝理由：违反宪法原则 V（简洁与 YAGNI），当前场景不需要分布式工作流

### 实现建议

```typescript
// 状态定义
type TaskStatus
  = | 'pending' // 等待执行
    | 'running' // 执行中
    | 'waiting_user' // 等待用户输入
    | 'completed' // 已完成
    | 'failed' // 失败
    | 'cancelled' // 已取消

// 事件类型
type TaskEvent
  = | { type: 'created', timestamp: number, data: CreateTaskData }
    | { type: 'assigned', timestamp: number, agentId: string }
    | { type: 'started', timestamp: number }
    | { type: 'scored', timestamp: number, score: Score }
    | { type: 'mediated', timestamp: number, mediation: Mediation }
    | { type: 'user_query', timestamp: number, query: UserQuery }
    | { type: 'user_response', timestamp: number, response: string }
    | { type: 'completed', timestamp: number, result: any }
    | { type: 'failed', timestamp: number, error: Error }
    | { type: 'cancelled', timestamp: number, reason: string }

// 状态机
class TaskStateMachine {
  private transitions: Map<TaskStatus, TaskStatus[]> = new Map([
    ['pending', ['running', 'cancelled']],
    ['running', ['waiting_user', 'completed', 'failed', 'cancelled']],
    ['waiting_user', ['running', 'cancelled']],
    ['completed', []],
    ['failed', []],
    ['cancelled', []]
  ])

  canTransition(from: TaskStatus, to: TaskStatus): boolean {
    return this.transitions.get(from)?.includes(to) ?? false
  }
}
```

---

## 研究任务 2：Agent 通信协议

### 决策
采用 **事件总线 + 直接调用** 的混合模式。

### 理由
1. **事件总线用于异步通知**：
   - 任务状态变更通知
   - 评分结果通知
   - 调节触发通知
   - 解耦组件，提高可扩展性

2. **直接调用用于同步操作**：
   - Agent 执行任务
   - 评分器评分
   - 调节者分析
   - 性能好，调试简单

3. **使用 hookable 实现事件总线**：
   - UnJS 生态组件，符合宪法原则 V
   - 轻量级，易于使用
   - 支持异步钩子

### 通信模式

```typescript
// 事件总线（异步通知）
import { createHooks } from 'hookable'

interface OrchestratorHooks {
  'task:created': (task: Task) => void
  'task:assigned': (task: Task, agentId: string) => void
  'task:started': (task: Task) => void
  'task:completed': (task: Task, result: any) => void
  'task:failed': (task: Task, error: Error) => void
  'score:submitted': (score: Score) => void
  'mediation:triggered': (mediation: Mediation) => void
}

const hooks = createHooks<OrchestratorHooks>()

// 直接调用（同步操作）
interface AgentExecutor {
  execute: (task: Task) => Promise<TaskResult>
}

interface Scorer {
  evaluate: (task: Task, result: TaskResult) => Promise<Score>
}

interface Mediator {
  analyze: (task: Task, history: TaskHistory) => Promise<Mediation>
}
```

### 考虑的替代方案

1. **消息队列（Redis/RabbitMQ）**
   - 优点：支持分布式，可靠性高
   - 缺点：引入外部依赖，增加部署复杂度
   - 拒绝理由：当前场景是单机运行，不需要分布式消息队列

2. **纯事件驱动**
   - 优点：完全解耦，易于扩展
   - 缺点：调试困难，性能开销大
   - 拒绝理由：同步操作（如 Agent 执行）不适合纯事件驱动

3. **gRPC/HTTP API**
   - 优点：标准化，支持跨语言
   - 缺点：增加网络开销，复杂度高
   - 拒绝理由：当前场景是进程内通信，不需要网络协议

### 实现建议

使用 hookable 实现事件总线，直接函数调用实现同步操作。

---

## 研究任务 3：评分算法

### 决策
采用 **规则引擎 + 启发式** 的混合模式。

### 理由
1. **规则引擎**：
   - 明确的评分标准，易于理解和调试
   - 支持用户自定义评分规则
   - 符合宪法原则 IV（配置驱动）

2. **启发式**：
   - 处理模糊情况（如部分完成）
   - 基于历史数据调整评分阈值
   - 提供更灵活的评分策略

3. **不使用 ML 模型**：
   - 避免引入复杂依赖
   - 评分标准需要可解释性
   - 符合宪法原则 V（简洁与 YAGNI）

### 评分规则

```typescript
interface ScoringRule {
  name: string
  condition: (task: Task, result: TaskResult) => boolean
  score: 'pass' | 'reject'
  feedback: string
}

// 示例规则
const rules: ScoringRule[] = [
  {
    name: 'completion_check',
    condition: (task, result) => result.completed === true,
    score: 'pass',
    feedback: '任务已完成'
  },
  {
    name: 'error_check',
    condition: (task, result) => result.error !== undefined,
    score: 'reject',
    feedback: '任务执行出错'
  },
  {
    name: 'timeout_check',
    condition: (task, result) => result.duration > task.timeout,
    score: 'reject',
    feedback: '任务执行超时'
  }
]

// 启发式：基于历史成功率调整阈值
function adjustThreshold(task: Task, history: TaskHistory): number {
  const successRate = history.scores.filter(s => s.result === 'pass').length / history.scores.length
  if (successRate < 0.5) {
    // 成功率低，降低标准
    return 0.6
  }
  return 0.8 // 默认阈值
}
```

### 考虑的替代方案

1. **ML 模型（如分类器）**
   - 优点：可以学习复杂模式
   - 缺点：需要训练数据，黑盒，难以解释
   - 拒绝理由：评分标准需要可解释性，用户需要理解为什么被驳回

2. **LLM 评分**
   - 优点：可以理解自然语言，灵活
   - 缺点：成本高，延迟大，不稳定
   - 拒绝理由：评分是高频操作，不适合使用 LLM

3. **固定阈值**
   - 优点：简单直接
   - 缺点：缺乏灵活性，无法适应不同场景
   - 拒绝理由：不同任务类型需要不同的评分标准

### 实现建议

使用规则引擎 + 启发式，规则可通过配置文件定义，启发式基于历史数据动态调整。

---

## 研究任务 4：调节策略

### 决策
采用 **案例推理（CBR）+ 规则引擎** 的混合模式。

### 理由
1. **案例推理**：
   - 从历史成功案例中学习
   - 找到相似问题的解决方案
   - 适合处理重复出现的问题

2. **规则引擎**：
   - 处理已知的常见问题
   - 提供快速的解决方案
   - 易于维护和扩展

3. **不使用 LLM**：
   - 避免成本和延迟
   - 调节需要快速响应（< 10 秒）
   - 符合宪法原则 V（简洁与 YAGNI）

### 调节流程

```typescript
interface MediationStrategy {
  // 1. 问题诊断
  diagnose: (task: Task, history: TaskHistory) => Diagnosis

  // 2. 查找相似案例
  findSimilarCases: (diagnosis: Diagnosis) => Case[]

  // 3. 生成解决方案
  generateSolutions: (diagnosis: Diagnosis, cases: Case[]) => Solution[]

  // 4. 应用解决方案
  applySolution: (task: Task, solution: Solution) => Promise<boolean>
}

// 诊断结果
interface Diagnosis {
  problemType: 'loop' | 'timeout' | 'error' | 'dependency' | 'unknown'
  symptoms: string[]
  context: Record<string, any>
}

// 案例
interface Case {
  diagnosis: Diagnosis
  solution: Solution
  success: boolean
  appliedAt: number
}

// 解决方案
interface Solution {
  type: 'retry' | 'reassign' | 'split' | 'escalate'
  params: Record<string, any>
  confidence: number
}
```

### 调节规则

```typescript
const mediationRules = [
  {
    // 循环问题：重新分配给不同 Agent
    condition: (d: Diagnosis) => d.problemType === 'loop',
    solution: { type: 'reassign', params: { excludeAgents: [task.assignedAgent] } }
  },
  {
    // 超时问题：拆分任务
    condition: (d: Diagnosis) => d.problemType === 'timeout',
    solution: { type: 'split', params: { maxSubtasks: 3 } }
  },
  {
    // 依赖问题：升级给用户
    condition: (d: Diagnosis) => d.problemType === 'dependency',
    solution: { type: 'escalate', params: { reason: 'missing_dependency' } }
  }
]
```

### 考虑的替代方案

1. **专家系统**
   - 优点：可以处理复杂推理
   - 缺点：规则维护成本高，难以扩展
   - 拒绝理由：当前场景问题类型有限，不需要复杂推理

2. **LLM 诊断**
   - 优点：可以理解复杂问题，生成创新解决方案
   - 缺点：成本高，延迟大，不稳定
   - 拒绝理由：调节需要快速响应，不适合使用 LLM

3. **固定策略**
   - 优点：简单直接
   - 缺点：无法学习和改进
   - 拒绝理由：需要从历史案例中学习，提高成功率

### 实现建议

使用案例推理 + 规则引擎，案例存储在 unstorage 中，规则可通过配置文件定义。

---

## 研究任务 5：并发控制

### 决策
采用 **Promise 池 + 信号量** 的模式。

### 理由
1. **Promise 池**：
   - 限制并发任务数量
   - 避免资源耗尽
   - 简单易用，符合 Node.js 异步模型

2. **信号量**：
   - 控制资源访问
   - 支持优先级调度
   - 易于实现和调试

3. **不使用 Worker 线程**：
   - Agent 执行主要是 I/O 密集型（调用 LLM API）
   - Worker 线程增加复杂度
   - 符合宪法原则 V（简洁与 YAGNI）

### 并发模型

```typescript
class TaskPool {
  private maxConcurrent: number = 5
  private running: Set<string> = new Set()
  private queue: Task[] = []

  async execute(task: Task): Promise<TaskResult> {
    // 等待空闲槽位
    await this.waitForSlot()

    // 标记为运行中
    this.running.add(task.id)

    try {
      // 执行任务
      const result = await this.executeTask(task)
      return result
    }
    finally {
      // 释放槽位
      this.running.delete(task.id)
      this.processQueue()
    }
  }

  private async waitForSlot(): Promise<void> {
    while (this.running.size >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.running.size < this.maxConcurrent) {
      const task = this.queue.shift()!
      this.execute(task)
    }
  }
}
```

### 考虑的替代方案

1. **Worker 线程**
   - 优点：真正的并行执行，隔离性好
   - 缺点：增加复杂度，通信开销大
   - 拒绝理由：Agent 执行主要是 I/O 密集型，不需要 CPU 并行

2. **进程池**
   - 优点：完全隔离，稳定性好
   - 缺点：资源开销大，通信复杂
   - 拒绝理由：过度设计，当前场景不需要进程隔离

3. **无限制并发**
   - 优点：简单直接
   - 缺点：可能导致资源耗尽
   - 拒绝理由：需要限制并发数量，避免系统过载

### 实现建议

使用 Promise 池 + 信号量，并发数量可通过配置文件设置。

---

## 研究任务 6：持久化策略

### 决策
采用 **unstorage + 文件系统驱动** 的方案。

### 理由
1. **unstorage**：
   - UnJS 生态组件，符合宪法原则 V
   - 统一的存储抽象，易于切换驱动
   - 支持多种驱动（fs、redis、sqlite 等）

2. **文件系统驱动**：
   - 零依赖，易于部署
   - 适合单机场景
   - 性能足够（< 2 秒查询响应）

3. **存储结构**：
   - 任务状态：`tasks/{task-id}.json`
   - 任务历史：`history/{task-id}.json`
   - 评分记录：`scores/{task-id}/{score-id}.json`
   - 调节记录：`mediations/{task-id}/{mediation-id}.json`

### 存储方案

```typescript
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'

// 创建存储实例
const storage = createStorage({
  driver: fsDriver({
    base: './.agentic/storage'
  })
})

// 任务存储
class TaskStore {
  async save(task: Task): Promise<void> {
    await storage.setItem(`tasks:${task.id}`, task)
  }

  async get(taskId: string): Promise<Task | null> {
    return await storage.getItem(`tasks:${taskId}`)
  }

  async list(): Promise<Task[]> {
    const keys = await storage.getKeys('tasks:')
    const tasks = await Promise.all(
      keys.map(key => storage.getItem(key))
    )
    return tasks.filter(Boolean) as Task[]
  }

  async delete(taskId: string): Promise<void> {
    await storage.removeItem(`tasks:${taskId}`)
  }
}

// 历史存储
class HistoryStore {
  async append(taskId: string, event: TaskEvent): Promise<void> {
    const history = await this.get(taskId) || { taskId, events: [] }
    history.events.push(event)
    await storage.setItem(`history:${taskId}`, history)
  }

  async get(taskId: string): Promise<TaskHistory | null> {
    return await storage.getItem(`history:${taskId}`)
  }
}
```

### 索引策略

```typescript
// 任务索引（按状态）
class TaskIndex {
  async addToIndex(task: Task): Promise<void> {
    const key = `index:status:${task.status}`
    const taskIds = await storage.getItem<string[]>(key) || []
    taskIds.push(task.id)
    await storage.setItem(key, taskIds)
  }

  async getByStatus(status: TaskStatus): Promise<string[]> {
    return await storage.getItem(`index:status:${status}`) || []
  }
}
```

### 考虑的替代方案

1. **Redis**
   - 优点：性能好，支持分布式
   - 缺点：需要额外部署，增加复杂度
   - 拒绝理由：当前场景是单机运行，文件系统性能足够

2. **SQLite**
   - 优点：支持 SQL 查询，事务支持
   - 缺点：需要额外依赖，增加复杂度
   - 拒绝理由：当前场景查询简单，不需要 SQL

3. **内存存储**
   - 优点：性能最好
   - 缺点：数据不持久化，重启丢失
   - 拒绝理由：任务状态需要持久化，支持系统重启后恢复

### 实现建议

使用 unstorage + 文件系统驱动，支持通过配置切换到其他驱动（如 redis）。

---

## 总结

### 技术选型汇总

| 领域 | 选择 | 理由 |
|------|------|------|
| 状态管理 | FSM + 事件日志 | 清晰的状态转换 + 完整的历史记录 |
| 通信协议 | 事件总线 + 直接调用 | 异步通知 + 同步操作 |
| 评分算法 | 规则引擎 + 启发式 | 可配置 + 灵活 |
| 调节策略 | 案例推理 + 规则引擎 | 学习历史 + 快速响应 |
| 并发控制 | Promise 池 + 信号量 | 简单有效 + 资源控制 |
| 持久化 | unstorage + fs | 零依赖 + 易于部署 |

### 核心依赖

- **citty**: CLI 框架
- **unstorage**: 存储抽象
- **hookable**: 事件总线
- **c12**: 配置加载
- **pathe**: 路径处理
- **consola**: 日志输出

### 下一步

进入 Phase 1：设计与契约
- 生成数据模型
- 定义 API 契约
- 编写快速开始指南
