# Tasks: 多层级 Agent 循环器

**输入**: `/specs/001-multi-agent-orchestrator/` 中的设计文档
**前置条件**: plan.md（必需）、spec.md（用户故事必需）、research.md、data-model.md、contracts/

**测试**: 已包含（TDD 方法，由宪法原则 III 强制要求：测试优先（不可协商））

**组织方式**: 任务按用户故事分组，以支持每个故事的独立实现和测试。

## 格式: `[ID] [P?] [Story] 描述`

- **[P]**: 可并行执行（不同文件、无依赖）
- **[Story]**: 该任务所属的用户故事（如 US1、US2、US3）
- 描述中包含准确的文件路径

## 路径约定

- **单项目**: 仓库根目录下的 `src/`、`tests/`
- 基于 plan.md 结构：源码使用 `src/{module}/`，测试使用 `tests/unit/{module}/` 和 `tests/integration/`

---

## 第一阶段：项目搭建（共享基础设施）

**目的**: 项目初始化与基本结构搭建

- [ ] T001 按照 plan.md 创建项目目录结构：src/{orchestrator,task,scorer,mediator,agents,storage,cli/commands,config,utils}/ 和 tests/{unit,integration,fixtures}/
- [ ] T002 初始化 TypeScript 项目，包含 package.json 和 tsconfig.json，安装依赖：citty、unstorage、c12、hookable、pathe、ofetch、consola、vitest、tsdown
- [ ] T003 [P] 在 eslint.config.ts 中配置 ESLint（使用 @antfu/eslint-config）
- [ ] T004 [P] 在 vitest.config.ts 中配置 Vitest 的单元测试和集成测试
- [ ] T005 [P] 在 tsdown.config.ts 中配置 tsdown 构建工具

---

## 第二阶段：基础层（阻塞型前置条件）

**目的**: 核心类型系统、存储层、配置和工具函数，必须在任何用户故事开始之前全部完成

**⚠️ 关键**: 在此阶段完成之前，不能开始任何用户故事的工作

### 类型定义

- [ ] T006 [P] 在 src/task/types.ts 中定义 Task、TaskType、TaskStatus、TaskResult、TaskError、TaskHistory、TaskEvent、TaskStatistics、UserQuery、QueryOption 类型
- [ ] T007 [P] 在 src/scorer/types.ts 中定义 Score、ScoreResult、ScoreCriterion、ScoringRule 类型
- [ ] T008 [P] 在 src/mediator/types.ts 中定义 Mediation、Diagnosis、ProblemType、Solution、SolutionType、MediationResult 类型
- [ ] T009 [P] 在 src/agents/types.ts 中定义 Agent、AgentStatus、AgentConfig、RetryStrategy、AgentStatistics 类型
- [ ] T010 [P] 在 src/orchestrator/types.ts 中定义 OrchestratorHooks、OrchestratorConfig、SessionBinding、ReporterOptions 类型
- [ ] T011 [P] 在 src/storage/types.ts 中定义 StorageConfig 和存储接口（TaskStoreInterface、HistoryStoreInterface）

### 配置系统

- [ ] T012 在 src/config/schema.ts 中实现配置模式（orchestrator、scorer、mediator、storage、agents 各部分）
- [ ] T013 [P] 在 src/config/define.ts 中实现类型安全的 defineConfig 辅助函数
- [ ] T014 在 src/config/index.ts 中使用 c12 实现配置加载器（从 agentic.config.ts 加载、支持环境变量覆盖）

### 存储层

- [ ] T015 在 src/storage/index.ts 中使用 unstorage 实现存储工厂（fs 驱动、可配置基础路径）
- [ ] T016 在 src/storage/task-store.ts 中实现 TaskStore（save、get、list、delete、updateStatus，按 status/agent/parent 索引）
- [ ] T017 在 src/storage/history-store.ts 中实现 HistoryStore（appendEvent、getHistory、getStatistics、appendScore、appendMediation）

### 工具函数

- [ ] T018 [P] 在 src/utils/logger.ts 中使用 consola 实现日志工具（debug、info、warn、error 级别）
- [ ] T019 [P] 在 src/utils/timer.ts 中实现计时工具（createTimeout、createInterval、withTimeout 封装）
- [ ] T020 [P] 在 src/utils/validator.ts 中实现验证工具（generateUUID、validateTaskInput、validateConfig）
- [ ] T021 在 src/utils/index.ts 中实现工具函数入口点及重导出

### 基础层测试

- [ ] T022 [P] 在 tests/unit/config/config.test.ts 中编写配置加载的单元测试
- [ ] T023 [P] 在 tests/unit/storage/task-store.test.ts 中编写 TaskStore 的 CRUD 和索引单元测试
- [ ] T024 [P] 在 tests/unit/storage/history-store.test.ts 中编写 HistoryStore 事件追加的单元测试

**检查点**: 基础层就绪——可以开始用户故事的实现

---

## 第三阶段：用户故事 1 - 基础任务循环调度 (优先级: P1) 🎯 MVP

**目标**: 用户启动一个任务，系统自动判断类型、分配 Agent、执行、评分并返回结果。实现完整的 classify → assign → execute → score → decide 循环。

**独立测试**: 创建一个简单任务（如"生成一个 README 文件"），验证系统能正确判断类型为 local、分配给合适的 Agent、执行、评分通过后返回结果；评分驳回时能重试（最多 3 次）。

### 用户故事 1 的测试 ⚠️

> **注意：先编写这些测试，确保在实现之前它们是失败的**

- [ ] T025 [P] [US1] 在 tests/unit/task/classifier.test.ts 中编写 TaskClassifier 的单元测试（分类 local/downstream/inquiry）
- [ ] T026 [P] [US1] 在 tests/unit/task/manager.test.ts 中编写 TaskManager 的单元测试（创建任务、FSM 状态转换、重试逻辑）
- [ ] T027 [P] [US1] 在 tests/unit/task/queue.test.ts 中编写 TaskQueue 的单元测试（入队、出队、并发限制）
- [ ] T028 [P] [US1] 在 tests/unit/agents/loader.test.ts 中编写 AgentLoader 的单元测试（从目录读取 Agent 定义）
- [ ] T029 [P] [US1] 在 tests/unit/agents/registry.test.ts 中编写 AgentRegistry 的单元测试（注册、匹配能力、选择最佳）
- [ ] T030 [P] [US1] 在 tests/unit/scorer/evaluator.test.ts 中编写 Scorer 评估器的单元测试（基于规则的评分、启发式阈值）
- [ ] T031 [P] [US1] 在 tests/unit/orchestrator/loop.test.ts 中编写 Orchestrator 主循环的单元测试（完整 classify→assign→execute→score 循环）
- [ ] T032 [P] [US1] 在 tests/unit/orchestrator/reporter.test.ts 中编写 Session 报告器的单元测试（绑定会话到任务、按间隔发送进度、检测会话关闭）
- [ ] T033 [P] [US1] 在 tests/integration/task-flow.test.ts 中编写基础任务流程的集成测试（使用 mock agent 的端到端测试）
- [ ] T034 [P] [US1] 在 tests/integration/session-lifecycle.test.ts 中编写会话生命周期的集成测试（specify → 自动轮询 → 完成 → 会话结束）

### 用户故事 1 的实现

- [ ] T035 [US1] 在 src/agents/loader.ts 中实现 Agent 加载器（扫描 .cursor/agents/、.claude/agents/ 目录，解析 JSON 定义）
- [ ] T036 [US1] 在 src/agents/index.ts 中实现 Agent 注册表（register、unregister、getById、listAvailable、matchByCapabilities）
- [ ] T037 [US1] 在 src/agents/executor.ts 中实现 Agent 执行器（通过 agent 执行任务、处理结果/错误、遵守超时）
- [ ] T038 [US1] 在 src/task/classifier.ts 中实现任务分类器（分析描述关键词、匹配 agent 能力、确定类型）
- [ ] T039 [US1] 在 src/task/manager.ts 中实现带 FSM 的任务管理器（创建任务、转换状态、验证转换、处理重试）
- [ ] T040 [US1] 在 src/task/queue.ts 中实现带 Promise 池的任务队列（入队、出队、遵守配置中的 maxConcurrentTasks 限制）
- [ ] T041 [US1] 在 src/task/index.ts 中实现任务模块入口点及重导出
- [ ] T042 [US1] 在 src/scorer/evaluator.ts 中实现评分评估器（可配置规则、加权标准、启发式阈值调整）
- [ ] T043 [US1] 在 src/scorer/feedback.ts 中实现评分反馈处理器（解析反馈、生成改进建议）
- [ ] T044 [US1] 在 src/scorer/index.ts 中实现评分器入口点（评估任务结果、决定通过/驳回）
- [ ] T045 [US1] 在 src/orchestrator/index.ts 中使用 hookable 实现编排器事件钩子（task:created、task:assigned、task:completed、score:submitted）
- [ ] T046 [US1] 在 src/orchestrator/scheduler.ts 中实现调度器（将任务分配给最佳 agent、使用退避策略管理重试）
- [ ] T047 [US1] 在 src/orchestrator/dispatcher.ts 中实现分发器（按能力选择 agent、检查可用性、回退到队列）
- [ ] T048 [US1] 在 src/orchestrator/index.ts 中实现编排器主循环（classify → assign → execute → score → 决定下一步操作）
- [ ] T049 [US1] 在 src/orchestrator/reporter.ts 中实现会话报告器（将会话绑定到任务、每 10 秒可配置间隔自动轮询进度、检测会话关闭/断开，FR-012/FR-019）
- [ ] T050 [US1] 在 src/orchestrator/index.ts 中实现后台任务执行（将任务循环与会话生命周期解耦、会话断开时任务继续运行、在 unstorage 中持久化会话绑定，FR-019）
- [ ] T051 [US1] 在 src/cli/commands/init.ts 中实现 CLI init 命令（创建 .agentic/ 目录、配置文件、存储目录、agents 目录）
- [ ] T052 [US1] 在 src/cli/commands/specify.ts 中实现 CLI specify 命令（解析任务描述、创建任务、启动编排器循环、绑定会话报告器进行自动轮询、保持活跃会话直到任务完成/失败）
- [ ] T053 [US1] 在 src/cli/utils.ts 中实现 CLI 工具函数（表格格式化、进度显示、错误处理、JSON 输出）
- [ ] T054 [US1] 在 src/cli/index.ts 中使用 citty 搭建 CLI 入口点（注册 init、specify 命令、--help、--version）

**检查点**: 此时，用户故事 1 应完全可用——用户可以创建任务，系统自动分类、分配给 agent、执行、评分并返回结果。驳回时重试最多 3 次。`/agentic.specify` 命令维护一个持久 AI 会话，每 10 秒自动轮询进度。会话断开后任务在后台继续运行。这就是 MVP。

---

## 第四阶段：用户故事 2 - 下游任务委派 (优先级: P2)

**目标**: Agent 遇到需要其他专业领域处理的子任务时，自动识别并委派给下游 Agent，支持父子任务链和子任务结果汇总。

**独立测试**: 创建一个需要多步骤的任务（如"创建一个带有数据库和 API 的 Web 应用"），验证系统能拆分为多个子任务、分别委派给不同 Agent、子任务完成后汇总结果返回。

### 用户故事 2 的测试 ⚠️

> **注意：先编写这些测试，确保在实现之前它们是失败的**

- [ ] T055 [P] [US2] 在 tests/unit/task/downstream.test.ts 中编写父子任务创建和深度追踪的单元测试
- [ ] T056 [P] [US2] 在 tests/unit/task/dependency.test.ts 中编写循环依赖检测的单元测试
- [ ] T057 [P] [US2] 在 tests/integration/downstream-flow.test.ts 中编写多 Agent 委派流程的集成测试

### 用户故事 2 的实现

- [ ] T058 [US2] 在 src/task/manager.ts 中扩展 TaskManager 以支持父子任务创建（设置 parentTaskId、添加到 childTaskIds、追踪深度）
- [ ] T059 [US2] 在 src/task/manager.ts 中实现循环依赖检测（检查 parentTaskId 链、强制最大深度 10）
- [ ] T060 [US2] 在 src/orchestrator/dispatcher.ts 中扩展分发器以支持下游 Agent 选择（按专长查找 agent、排除当前 agent）
- [ ] T061 [US2] 在 src/orchestrator/index.ts 中扩展编排器循环以支持子任务生命周期（创建子任务 → 分发 → 等待 → 收集结果）
- [ ] T062 [US2] 在 src/orchestrator/scheduler.ts 中实现子任务结果聚合（等待所有子任务完成、合并结果、返回给父任务）
- [ ] T063 [US2] 在 src/agents/index.ts 中添加缺失 Agent 检测和用户通知（当找不到合适的 agent 时，FR-015）

**检查点**: 此时，用户故事 1 和 2 应都能正常工作——简单任务直接执行，复杂任务会被分解并委派给多个 agent。

---

## 第五阶段：用户故事 3 - 用户交互与确认 (优先级: P2)

**目标**: Agent 遇到需要用户决策的情况时，系统暂停处理、向用户询问、等待响应后继续执行。

**独立测试**: 创建一个有多种实现方案的任务（如"选择数据库：MySQL 或 PostgreSQL"），验证系统能暂停、发送选项给用户、接收响应、继续处理。

### 用户故事 3 的测试 ⚠️

> **注意：先编写这些测试，确保在实现之前它们是失败的**

- [ ] T064 [P] [US3] 在 tests/unit/task/user-query.test.ts 中编写 UserQuery 创建和响应处理的单元测试
- [ ] T065 [P] [US3] 在 tests/unit/task/user-interaction.test.ts 中编写 waiting_user 状态转换和超时的单元测试
- [ ] T066 [P] [US3] 在 tests/integration/user-interaction.test.ts 中编写用户交互流程的集成测试（暂停 → 询问 → 响应 → 恢复）

### 用户故事 3 的实现

- [ ] T067 [US3] 在 src/task/user-query.ts 中实现 UserQuery 管理器（创建带选项的查询、存储在 unstorage 中、等待响应）
- [ ] T068 [US3] 在 src/task/manager.ts 中扩展 TaskManager 以支持 waiting_user 状态转换和收到响应后恢复
- [ ] T069 [US3] 在 src/task/user-query.ts 中实现用户响应处理器（验证响应、更新查询、触发任务恢复）
- [ ] T070 [US3] 在 src/orchestrator/index.ts 中扩展编排器循环以支持 inquiry 任务类型（检测询问 → 暂停 → 询问用户 → 恢复）
- [ ] T071 [US3] 在 src/task/user-query.ts 中实现查询超时处理（默认 10 分钟、标记为 waiting_user、通知用户）
- [ ] T072 [US3] 在 src/cli/utils.ts 中添加 CLI 交互式提示用于用户查询（显示问题、选项、接受输入）

**检查点**: 此时，用户故事 1-3 应都能独立工作。任务可以直接执行、委派给子 agent、或暂停等待用户输入。

---

## 第六阶段：用户故事 4 - 调节者介入与问题解决 (优先级: P3)

**目标**: 任务多次驳回（默认 3 次）或遇到异常时，调节者自动介入、诊断问题、提供解决方案或升级给用户。

**独立测试**: 创建一个故意难以完成的任务，验证 3 次驳回后调节者自动介入、分析问题、提供解决方案（重新分配/拆分/升级）。

### 用户故事 4 的测试 ⚠️

> **注意：先编写这些测试，确保在实现之前它们是失败的**

- [ ] T073 [P] [US4] 在 tests/unit/mediator/analyzer.test.ts 中编写 Mediator 分析器的单元测试（从任务历史诊断问题类型）
- [ ] T074 [P] [US4] 在 tests/unit/mediator/resolver.test.ts 中编写 Mediator 解决器的单元测试（生成并排序解决方案）
- [ ] T075 [P] [US4] 在 tests/unit/mediator/cbr.test.ts 中编写 CBR 案例存储和检索的单元测试
- [ ] T076 [P] [US4] 在 tests/integration/mediation.test.ts 中编写调解流程的集成测试（3 次驳回 → 触发 → 诊断 → 解决）

### 用户故事 4 的实现

- [ ] T077 [US4] 在 src/mediator/analyzer.ts 中实现 Mediator 分析器（分析任务历史、识别问题类型：循环/超时/错误/依赖）
- [ ] T078 [US4] 在 src/mediator/resolver.ts 中实现 Mediator 解决器（生成解决方案：重试/重新分配/拆分/升级，按置信度排序）
- [ ] T079 [US4] 在 src/mediator/index.ts 中实现 CBR 案例存储（存储成功的调解记录、按问题类型查找相似案例）
- [ ] T080 [US4] 在 src/mediator/index.ts 中实现调解规则引擎（循环 → 重新分配并排除当前 agent、超时 → 拆分、依赖 → 升级）
- [ ] T081 [US4] 在 src/orchestrator/index.ts 中扩展编排器循环以支持调解触发（检测 retryCount >= 3、调用调节者、应用解决方案）
- [ ] T082 [US4] 在 src/mediator/resolver.ts 中实现当调节者无法解决时升级给用户（创建带诊断信息的 UserQuery）

**检查点**: 此时，所有用户故事 1-4 均可正常工作。系统能在任务卡住时通过调解进行自我修复。

---

## 第七阶段：用户故事 5 - 进度监控与断线重连 (优先级: P3)

**目标**: 用户可以通过 `/agentic.status` 重新连接到正在运行的任务、查询历史任务状态、或在 AI 会话断开后恢复监控。支持任务取消。

**独立测试**: 启动一个长时间任务后关闭 AI 会话，然后在新会话中使用 `/agentic.status <task-id>` 验证能否看到任务的当前进度，并可选择重新进入持续监控模式。使用 `/agentic.status`（无参数）列出所有活跃任务。使用 `agentic cancel <id>` 取消任务。

### 用户故事 5 的测试 ⚠️

> **注意：先编写这些测试，确保在实现之前它们是失败的**

- [ ] T083 [P] [US5] 在 tests/unit/cli/status.test.ts 中编写 CLI status 命令的单元测试（格式化任务状态、进度显示、重连到运行中的任务）
- [ ] T084 [P] [US5] 在 tests/unit/cli/cancel.test.ts 中编写 CLI cancel 命令的单元测试（取消运行中的任务、拒绝已完成的任务）
- [ ] T085 [P] [US5] 在 tests/unit/cli/active-tasks.test.ts 中编写活跃任务列表的单元测试（列出所有活跃任务、显示摘要）
- [ ] T086 [P] [US5] 在 tests/integration/reconnection.test.ts 中编写断线重连流程的集成测试（断开 → status → 恢复轮询 → 显示待处理查询）

### 用户故事 5 的实现

- [ ] T087 [US5] 在 src/cli/commands/status.ts 中实现带重连功能的 CLI status 命令（按 ID 查询任务、显示状态/进度/agent/时长、通过会话报告器恢复轮询模式，FR-020）
- [ ] T088 [US5] 在 src/cli/commands/status.ts 中实现活跃任务列表（无 task-id 时：列出所有活跃任务及状态摘要，FR-021）
- [ ] T089 [US5] 在 src/cli/commands/status.ts 中实现重连时显示待处理查询（当任务处于 waiting_user 状态时，立即显示待处理的问题，FR-022）
- [ ] T090 [US5] 在 src/cli/commands/cancel.ts 中实现 CLI cancel 命令（附带原因取消任务、验证可取消状态）
- [ ] T091 [US5] 在 src/cli/commands/status.ts 中实现历史记录显示命令（显示完整事件时间线、评分、调解记录、统计数据）
- [ ] T092 [US5] 在 src/cli/utils.ts 中为所有 CLI 命令添加 JSON 输出格式支持（--json 标志）
- [ ] T093 [US5] 在 src/cli/index.ts 中将 status 和 cancel 命令注册到 CLI 入口点

**检查点**: 所有用户故事现已独立可用。完整系统具备监控、断线重连和取消功能。

---

## 第八阶段：打磨与跨切面关注点

**目的**: 边界情况、性能、文档和影响多个用户故事的改进

- [ ] T094 [P] 边界情况：并发任务限制——当运行数量 >= maxConcurrentTasks 时将新任务加入队列，在 src/task/queue.ts 中实现
- [ ] T095 [P] 边界情况：Agent 崩溃恢复——检测无响应的 agent，30 秒内重新分配任务，在 src/orchestrator/scheduler.ts 中实现
- [ ] T096 边界情况：任务超时处理——自动终止超时任务并标记为失败，在 src/orchestrator/scheduler.ts 中实现
- [ ] T097 [P] 边界情况：网络中断——操作前持久化状态，恢复后继续执行，在 src/storage/task-store.ts 中实现
- [ ] T098 边界情况：会话断开——验证 AI 会话关闭后任务在后台继续运行、会话绑定被清理、可通过 status 重连（FR-019），在 src/orchestrator/reporter.ts 中实现
- [ ] T099 边界情况：同一会话中多次 specify——当会话已绑定活跃任务时拒绝第二次 /agentic.specify，显示包含当前任务 ID 的错误信息，在 src/cli/commands/specify.ts 中实现
- [ ] T100 [P] 为 src/ 中所有公共 API 添加完整的 JSDoc 文档
- [ ] T101 性能验证：确保任务启动 < 30 秒、分类 < 5 秒、状态查询 < 2 秒
- [ ] T102 运行 quickstart.md 验证：端到端执行所有已记录的场景
- [ ] T103 在 src/index.ts 中实现包入口点及公共 API 的重导出

---

## 依赖关系与执行顺序

### 阶段依赖

- **搭建（第一阶段）**: 无依赖——可立即开始
- **基础层（第二阶段）**: 依赖搭建阶段完成——阻塞所有用户故事
- **用户故事（第三至七阶段）**: 全部依赖基础层阶段完成
  - 各用户故事可并行推进（如有人力）
  - 或按优先级顺序执行（P1 → P2 → P3）
- **打磨（第八阶段）**: 依赖所有目标用户故事完成

### 用户故事依赖

- **用户故事 1 (P1)**: 基础层（第二阶段）完成后即可开始——不依赖其他故事。**这是 MVP。** 包含会话生命周期（报告器、后台执行）。
- **用户故事 2 (P2)**: 基础层（第二阶段）完成后即可开始——扩展 US1 的组件（TaskManager、Dispatcher、Orchestrator），但应可独立测试
- **用户故事 3 (P2)**: 基础层（第二阶段）完成后即可开始——扩展编排器循环，但应可独立测试
- **用户故事 4 (P3)**: 基础层（第二阶段）完成后即可开始——使用 US1 评分流程中的 TaskHistory，但调节者模块是独立的
- **用户故事 5 (P3)**: 依赖 US1 的会话报告器（第三阶段）——扩展它以支持断线重连和活跃任务列表

### 各用户故事内部

- 测试必须先编写并确认失败，再开始实现（TDD）
- 先类型，再存储
- 先存储，再管理器/服务
- 先管理器/服务，再编排器扩展
- 先核心实现，再 CLI 命令
- 当前故事完成后再进入下一优先级

### 并行机会

- 搭建阶段所有标记 [P] 的任务可并行执行（T003、T004、T005）
- 第二阶段所有标记 [P] 的类型定义任务可并行执行（T006-T011）
- 配置任务 T013 可与存储任务并行执行（不同模块）
- 工具函数任务 T018、T019、T020 可全部并行执行
- 基础层测试 T022、T023、T024 可全部并行执行
- 各用户故事内标记 [P] 的测试可全部并行执行
- 基础层阶段完成后，所有用户故事可并行启动（如团队有足够人力）
- US5 依赖 US1 的会话报告器；其他故事保持独立

---

## 并行示例：用户故事 1

```bash
# 同时启动用户故事 1 的所有测试（TDD——先写测试）：
Task: T025 "TaskClassifier 单元测试，在 tests/unit/task/classifier.test.ts"
Task: T026 "TaskManager 单元测试，在 tests/unit/task/manager.test.ts"
Task: T027 "TaskQueue 单元测试，在 tests/unit/task/queue.test.ts"
Task: T028 "AgentLoader 单元测试，在 tests/unit/agents/loader.test.ts"
Task: T029 "AgentRegistry 单元测试，在 tests/unit/agents/registry.test.ts"
Task: T030 "Scorer 评估器单元测试，在 tests/unit/scorer/evaluator.test.ts"
Task: T031 "Orchestrator 主循环单元测试，在 tests/unit/orchestrator/loop.test.ts"
Task: T032 "Session 报告器单元测试，在 tests/unit/orchestrator/reporter.test.ts"
Task: T033 "任务流程集成测试，在 tests/integration/task-flow.test.ts"
Task: T034 "会话生命周期集成测试，在 tests/integration/session-lifecycle.test.ts"

# 然后启动可独立执行的实现任务：
Task: T035 "Agent 加载器，在 src/agents/loader.ts"          # [P] 可与 T038 并行
Task: T038 "任务分类器，在 src/task/classifier.ts"           # [P] 可与 T035 并行
Task: T042 "Scorer 评估器，在 src/scorer/evaluator.ts"      # [P] 可与 T035、T038 并行
```

---

## 并行示例：用户故事并行开发

```bash
# 基础层（第二阶段）完成后，不同开发者可以分别负责：
开发者 A：第三阶段（US1 - 基础任务循环 + 会话生命周期） # P1 MVP
开发者 B：第六阶段（US4 - 调节者介入）                    # P3，独立模块
开发者 C：第七阶段（US5 - 断线重连与监控）                # P3，依赖 US1 报告器

# US2 和 US3 扩展 US1 的编排器，最好在 US1 之后完成或由同一开发者负责
```

---

## 实施策略

### MVP 优先（仅用户故事 1）

1. 完成第一阶段：项目搭建
2. 完成第二阶段：基础层（关键——阻塞所有故事）
3. 完成第三阶段：用户故事 1
4. **停下来验证**：独立测试用户故事 1
   - 执行：`agentic init` → 创建配置和目录
   - 执行：`agentic specify "生成一个 README 文件"` → 创建任务，AI 会话进入轮询模式，每 10 秒更新进度
   - 验证：任务被分类、分配、执行、评分，结果在同一会话中返回
   - 验证：驳回时重试有效（最多 3 次）
   - 验证：关闭会话不会停止任务（后台执行）
5. 如果就绪则部署/演示——**这就是 MVP**

### 增量交付

1. 完成搭建 + 基础层 → 基础就绪
2. 添加用户故事 1 → 独立测试 → 部署/演示（**MVP！** 包含会话生命周期）
3. 添加用户故事 2 → 测试委派 → 部署/演示（多 Agent 支持）
4. 添加用户故事 3 → 测试交互 → 部署/演示（用户输入支持）
5. 添加用户故事 4 → 测试调解 → 部署/演示（自我修复）
6. 添加用户故事 5 → 测试断线重连 → 部署/演示（完整可观测性 + 断线重连）
7. 每个故事独立增值，不破坏已有功能

### 并行团队策略

多开发者协作时：

1. 团队共同完成搭建 + 基础层
2. 基础层完成后：
   - 开发者 A：用户故事 1（MVP，最高优先级，包含会话报告器）
   - 开发者 B：用户故事 4（独立的调节者模块）
   - 开发者 C：用户故事 5（依赖 US1 报告器，可先并行搭建 CLI 脚手架）
3. US1 完成后：
   - 开发者 A：用户故事 2（扩展编排器）
   - 开发者 B：用户故事 3（扩展编排器）
   - 开发者 C：用户故事 5 断线重连（此时 US1 报告器已可用）
4. 各故事独立完成并集成

---

## 备注

- [P] 任务 = 不同文件、不依赖未完成的任务
- [Story] 标签将任务映射到特定用户故事，便于追溯
- 每个用户故事应可独立完成和测试
- TDD：先写测试，确认失败，再实现
- 每个任务或逻辑分组完成后提交
- 可在任何检查点停下来独立验证故事
- 技术栈：citty（CLI）、unstorage（存储）、c12（配置）、hookable（事件）、consola（日志）、vitest（测试）
- 所有状态通过 unstorage 的 fs 驱动持久化（可配置）
- FSM + 事件日志用于任务状态管理（依据 research.md 决策）
- 规则引擎 + 启发式用于评分（依据 research.md 决策）
- CBR + 规则用于调解（依据 research.md 决策）
- Promise 池用于并发控制（依据 research.md 决策）
- 会话报告器处理 AI 会话绑定和进度轮询（依据 spec.md 会话生命周期）
- 任务在后台运行，与会话生命周期解耦（依据 FR-019）
