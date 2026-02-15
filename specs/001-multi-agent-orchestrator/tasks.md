# Tasks: 多层级 Agent 循环器

**Input**: Design documents from `/specs/001-multi-agent-orchestrator/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included (TDD approach mandated by constitution principle III: 测试优先（不可协商）)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Based on plan.md structure: `src/{module}/` for source, `tests/unit/{module}/` and `tests/integration/` for tests

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project directory structure per plan.md: src/{orchestrator,task,scorer,mediator,agents,storage,cli/commands,config,utils}/ and tests/{unit,integration,fixtures}/
- [ ] T002 Initialize TypeScript project with package.json and tsconfig.json, install dependencies: citty, unstorage, c12, hookable, pathe, ofetch, consola, vitest, tsdown
- [ ] T003 [P] Configure ESLint with @antfu/eslint-config in eslint.config.ts
- [ ] T004 [P] Configure Vitest for unit and integration tests in vitest.config.ts
- [ ] T005 [P] Configure tsdown build tool in tsdown.config.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type system, storage layer, configuration, and utilities that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Type Definitions

- [ ] T006 [P] Define Task, TaskType, TaskStatus, TaskResult, TaskError, TaskHistory, TaskEvent, TaskStatistics, UserQuery, QueryOption types in src/task/types.ts
- [ ] T007 [P] Define Score, ScoreResult, ScoreCriterion, ScoringRule types in src/scorer/types.ts
- [ ] T008 [P] Define Mediation, Diagnosis, ProblemType, Solution, SolutionType, MediationResult types in src/mediator/types.ts
- [ ] T009 [P] Define Agent, AgentStatus, AgentConfig, RetryStrategy, AgentStatistics types in src/agents/types.ts
- [ ] T010 [P] Define OrchestratorHooks, OrchestratorConfig, SessionBinding, ReporterOptions types in src/orchestrator/types.ts
- [ ] T011 [P] Define StorageConfig and store interfaces (TaskStoreInterface, HistoryStoreInterface) in src/storage/types.ts

### Configuration System

- [ ] T012 Implement configuration schema (orchestrator, scorer, mediator, storage, agents sections) in src/config/schema.ts
- [ ] T013 [P] Implement defineConfig helper for type-safe config authoring in src/config/define.ts
- [ ] T014 Implement config loader with c12 (load from agentic.config.ts, env overrides) in src/config/index.ts

### Storage Layer

- [ ] T015 Implement storage factory with unstorage (fs driver, configurable base path) in src/storage/index.ts
- [ ] T016 Implement TaskStore (save, get, list, delete, updateStatus, index by status/agent/parent) in src/storage/task-store.ts
- [ ] T017 Implement HistoryStore (appendEvent, getHistory, getStatistics, appendScore, appendMediation) in src/storage/history-store.ts

### Utilities

- [ ] T018 [P] Implement logger utility with consola (debug, info, warn, error levels) in src/utils/logger.ts
- [ ] T019 [P] Implement timer utility (createTimeout, createInterval, withTimeout wrapper) in src/utils/timer.ts
- [ ] T020 [P] Implement validator utility (generateUUID, validateTaskInput, validateConfig) in src/utils/validator.ts
- [ ] T021 Implement utils entry point with re-exports in src/utils/index.ts

### Foundational Tests

- [ ] T022 [P] Unit test for configuration loading in tests/unit/config/config.test.ts
- [ ] T023 [P] Unit test for TaskStore CRUD and indexing in tests/unit/storage/task-store.test.ts
- [ ] T024 [P] Unit test for HistoryStore event appending in tests/unit/storage/history-store.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 基础任务循环调度 (Priority: P1) 🎯 MVP

**Goal**: 用户启动一个任务，系统自动判断类型、分配 Agent、执行、评分并返回结果。实现完整的 classify → assign → execute → score → decide 循环。

**Independent Test**: 创建一个简单任务（如"生成一个 README 文件"），验证系统能正确判断类型为 local、分配给合适的 Agent、执行、评分通过后返回结果；评分驳回时能重试（最多 3 次）。

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T025 [P] [US1] Unit test for TaskClassifier (classify local/downstream/inquiry) in tests/unit/task/classifier.test.ts
- [ ] T026 [P] [US1] Unit test for TaskManager (create task, FSM transitions, retry logic) in tests/unit/task/manager.test.ts
- [ ] T027 [P] [US1] Unit test for TaskQueue (enqueue, dequeue, concurrency limit) in tests/unit/task/queue.test.ts
- [ ] T028 [P] [US1] Unit test for AgentLoader (read agent definitions from directories) in tests/unit/agents/loader.test.ts
- [ ] T029 [P] [US1] Unit test for AgentRegistry (register, match capabilities, select best) in tests/unit/agents/registry.test.ts
- [ ] T030 [P] [US1] Unit test for Scorer evaluator (rule-based scoring, heuristic threshold) in tests/unit/scorer/evaluator.test.ts
- [ ] T031 [P] [US1] Unit test for Orchestrator main loop (full classify→assign→execute→score cycle) in tests/unit/orchestrator/loop.test.ts
- [ ] T032 [P] [US1] Unit test for Session reporter (bind session to task, emit progress at interval, detect session close) in tests/unit/orchestrator/reporter.test.ts
- [ ] T033 [P] [US1] Integration test for basic task flow (end-to-end with mock agent) in tests/integration/task-flow.test.ts
- [ ] T034 [P] [US1] Integration test for session lifecycle (specify → auto-poll → complete → session end) in tests/integration/session-lifecycle.test.ts

### Implementation for User Story 1

- [ ] T035 [US1] Implement Agent loader (scan .cursor/agents/, .claude/agents/ directories, parse JSON definitions) in src/agents/loader.ts
- [ ] T036 [US1] Implement Agent registry (register, unregister, getById, listAvailable, matchByCapabilities) in src/agents/index.ts
- [ ] T037 [US1] Implement Agent executor (execute task via agent, handle result/error, respect timeout) in src/agents/executor.ts
- [ ] T038 [US1] Implement Task classifier (analyze description keywords, match agent capabilities, determine type) in src/task/classifier.ts
- [ ] T039 [US1] Implement Task manager with FSM (create task, transition status, validate transitions, handle retries) in src/task/manager.ts
- [ ] T040 [US1] Implement Task queue with Promise pool (enqueue, dequeue, respect maxConcurrentTasks limit from config) in src/task/queue.ts
- [ ] T041 [US1] Implement Task entry point with re-exports in src/task/index.ts
- [ ] T042 [US1] Implement Scorer evaluator (configurable rules, weighted criteria, heuristic threshold adjustment) in src/scorer/evaluator.ts
- [ ] T043 [US1] Implement Scorer feedback processor (parse feedback, generate improvement suggestions) in src/scorer/feedback.ts
- [ ] T044 [US1] Implement Scorer entry point (evaluate task result, decide pass/reject) in src/scorer/index.ts
- [ ] T045 [US1] Implement Orchestrator event hooks with hookable (task:created, task:assigned, task:completed, score:submitted) in src/orchestrator/index.ts
- [ ] T046 [US1] Implement Scheduler (assign task to best agent, manage retry with backoff strategy) in src/orchestrator/scheduler.ts
- [ ] T047 [US1] Implement Dispatcher (select agent by capabilities, check availability, fallback to queue) in src/orchestrator/dispatcher.ts
- [ ] T048 [US1] Implement Orchestrator main loop (classify → assign → execute → score → decide next action) in src/orchestrator/index.ts
- [ ] T049 [US1] Implement Session reporter (bind session to task, auto-poll progress every 10s configurable, detect session close/disconnect, FR-012/FR-019) in src/orchestrator/reporter.ts
- [ ] T050 [US1] Implement background task execution (decouple task loop from session lifecycle, task continues when session drops, persist session binding in unstorage, FR-019) in src/orchestrator/index.ts
- [ ] T051 [US1] Implement CLI init command (create .agentic/ directory, config file, storage dir, agents dir) in src/cli/commands/init.ts
- [ ] T052 [US1] Implement CLI specify command (parse task description, create task, start orchestrator loop, bind session reporter for auto-polling, maintain active session until task completes/fails) in src/cli/commands/specify.ts
- [ ] T053 [US1] Implement CLI utility functions (table formatter, progress display, error handler, JSON output) in src/cli/utils.ts
- [ ] T054 [US1] Setup CLI entry point with citty (register init, specify commands, --help, --version) in src/cli/index.ts

**Checkpoint**: At this point, User Story 1 should be fully functional - users can create tasks, have them classified, assigned to agents, executed, scored, and results returned. Retry on reject works up to 3 times. The `/agentic.specify` command maintains a persistent AI session with auto-polling progress. Tasks continue running in background if the session disconnects. This is the MVP.

---

## Phase 4: User Story 2 - 下游任务委派 (Priority: P2)

**Goal**: Agent 遇到需要其他专业领域处理的子任务时，自动识别并委派给下游 Agent，支持父子任务链和子任务结果汇总。

**Independent Test**: 创建一个需要多步骤的任务（如"创建一个带有数据库和 API 的 Web 应用"），验证系统能拆分为多个子任务、分别委派给不同 Agent、子任务完成后汇总结果返回。

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T055 [P] [US2] Unit test for parent-child task creation and depth tracking in tests/unit/task/downstream.test.ts
- [ ] T056 [P] [US2] Unit test for circular dependency detection in tests/unit/task/dependency.test.ts
- [ ] T057 [P] [US2] Integration test for multi-agent delegation flow in tests/integration/downstream-flow.test.ts

### Implementation for User Story 2

- [ ] T058 [US2] Extend TaskManager for parent-child task creation (set parentTaskId, add to childTaskIds, track depth) in src/task/manager.ts
- [ ] T059 [US2] Implement circular dependency detection (check parentTaskId chain, enforce max depth 10) in src/task/manager.ts
- [ ] T060 [US2] Extend Dispatcher for downstream agent selection (find agents by specialty, exclude current agent) in src/orchestrator/dispatcher.ts
- [ ] T061 [US2] Extend Orchestrator loop for subtask lifecycle (create subtask → dispatch → wait → collect result) in src/orchestrator/index.ts
- [ ] T062 [US2] Implement subtask result aggregation (wait for all children, merge results, return to parent) in src/orchestrator/scheduler.ts
- [ ] T063 [US2] Add missing agent detection and user notification when no suitable agent found (FR-015) in src/agents/index.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - simple tasks execute directly, complex tasks are decomposed and delegated to multiple agents.

---

## Phase 5: User Story 3 - 用户交互与确认 (Priority: P2)

**Goal**: Agent 遇到需要用户决策的情况时，系统暂停处理、向用户询问、等待响应后继续执行。

**Independent Test**: 创建一个有多种实现方案的任务（如"选择数据库：MySQL 或 PostgreSQL"），验证系统能暂停、发送选项给用户、接收响应、继续处理。

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T064 [P] [US3] Unit test for UserQuery creation and response handling in tests/unit/task/user-query.test.ts
- [ ] T065 [P] [US3] Unit test for waiting_user status transition and timeout in tests/unit/task/user-interaction.test.ts
- [ ] T066 [P] [US3] Integration test for user interaction flow (pause → query → respond → resume) in tests/integration/user-interaction.test.ts

### Implementation for User Story 3

- [ ] T067 [US3] Implement UserQuery manager (create query with options, store in unstorage, wait for response) in src/task/user-query.ts
- [ ] T068 [US3] Extend TaskManager for waiting_user status transition and resume on response in src/task/manager.ts
- [ ] T069 [US3] Implement user response handler (validate response, update query, trigger task resume) in src/task/user-query.ts
- [ ] T070 [US3] Extend Orchestrator loop for inquiry task type (detect inquiry → pause → query user → resume) in src/orchestrator/index.ts
- [ ] T071 [US3] Implement query timeout handling (default 10 min, mark as waiting_user, notify user) in src/task/user-query.ts
- [ ] T072 [US3] Add CLI interactive prompt for user queries (display question, options, accept input) in src/cli/utils.ts

**Checkpoint**: At this point, User Stories 1-3 should all work independently. Tasks can be executed directly, delegated to sub-agents, or paused for user input.

---

## Phase 6: User Story 4 - 调节者介入与问题解决 (Priority: P3)

**Goal**: 任务多次驳回（默认 3 次）或遇到异常时，调节者自动介入、诊断问题、提供解决方案或升级给用户。

**Independent Test**: 创建一个故意难以完成的任务，验证 3 次驳回后调节者自动介入、分析问题、提供解决方案（重新分配/拆分/升级）。

### Tests for User Story 4 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T073 [P] [US4] Unit test for Mediator analyzer (diagnose problem type from task history) in tests/unit/mediator/analyzer.test.ts
- [ ] T074 [P] [US4] Unit test for Mediator resolver (generate and rank solutions) in tests/unit/mediator/resolver.test.ts
- [ ] T075 [P] [US4] Unit test for CBR case storage and retrieval in tests/unit/mediator/cbr.test.ts
- [ ] T076 [P] [US4] Integration test for mediation flow (3 rejects → trigger → diagnose → resolve) in tests/integration/mediation.test.ts

### Implementation for User Story 4

- [ ] T077 [US4] Implement Mediator analyzer (analyze task history, identify problem type: loop/timeout/error/dependency) in src/mediator/analyzer.ts
- [ ] T078 [US4] Implement Mediator resolver (generate solutions: retry/reassign/split/escalate, rank by confidence) in src/mediator/resolver.ts
- [ ] T079 [US4] Implement CBR case storage (store successful mediations, find similar cases by problem type) in src/mediator/index.ts
- [ ] T080 [US4] Implement mediation rule engine (loop → reassign excluding current agent, timeout → split, dependency → escalate) in src/mediator/index.ts
- [ ] T081 [US4] Extend Orchestrator loop for mediation trigger (detect retryCount >= 3, invoke mediator, apply solution) in src/orchestrator/index.ts
- [ ] T082 [US4] Implement escalation to user when mediator cannot resolve (create UserQuery with diagnosis) in src/mediator/resolver.ts

**Checkpoint**: At this point, all User Stories 1-4 are functional. The system can self-heal through mediation when tasks get stuck.

---

## Phase 7: User Story 5 - 进度监控与断线重连 (Priority: P3)

**Goal**: 用户可以通过 `/agentic.status` 重新连接到正在运行的任务、查询历史任务状态、或在 AI 会话断开后恢复监控。支持任务取消。

**Independent Test**: 启动一个长时间任务后关闭 AI 会话，然后在新会话中使用 `/agentic.status <task-id>` 验证能否看到任务的当前进度，并可选择重新进入持续监控模式。使用 `/agentic.status`（无参数）列出所有活跃任务。使用 `agentic cancel <id>` 取消任务。

### Tests for User Story 5 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T083 [P] [US5] Unit test for CLI status command (format task status, progress display, reconnect to running task) in tests/unit/cli/status.test.ts
- [ ] T084 [P] [US5] Unit test for CLI cancel command (cancel running task, reject completed task) in tests/unit/cli/cancel.test.ts
- [ ] T085 [P] [US5] Unit test for active task listing (list all active tasks, display summary) in tests/unit/cli/active-tasks.test.ts
- [ ] T086 [P] [US5] Integration test for reconnection flow (disconnect → status → resume polling → show pending query) in tests/integration/reconnection.test.ts

### Implementation for User Story 5

- [ ] T087 [US5] Implement CLI status command with reconnection (query task by ID, display status/progress/agent/duration, resume polling mode via session reporter, FR-020) in src/cli/commands/status.ts
- [ ] T088 [US5] Implement active task listing (no task-id: list all active tasks with status summary, FR-021) in src/cli/commands/status.ts
- [ ] T089 [US5] Implement pending query display on reconnect (when task is waiting_user, immediately show pending question, FR-022) in src/cli/commands/status.ts
- [ ] T090 [US5] Implement CLI cancel command (cancel task with reason, validate cancellable state) in src/cli/commands/cancel.ts
- [ ] T091 [US5] Implement history display command (show full event timeline, scores, mediations, statistics) in src/cli/commands/status.ts
- [ ] T092 [US5] Add JSON output format support (--json flag) for all CLI commands in src/cli/utils.ts
- [ ] T093 [US5] Register status and cancel commands in CLI entry point in src/cli/index.ts

**Checkpoint**: All user stories are now independently functional. Full system is operational with monitoring, reconnection, and cancel capabilities.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, performance, documentation, and improvements that affect multiple user stories

- [ ] T094 [P] Edge case: concurrent task limit - queue new tasks when running count >= maxConcurrentTasks in src/task/queue.ts
- [ ] T095 [P] Edge case: Agent crash recovery - detect unresponsive agent, reassign task within 30s in src/orchestrator/scheduler.ts
- [ ] T096 Edge case: task timeout handling - auto-terminate tasks exceeding timeout, mark as failed in src/orchestrator/scheduler.ts
- [ ] T097 [P] Edge case: network interruption - persist state before operations, resume on recovery in src/storage/task-store.ts
- [ ] T098 Edge case: session disconnect - verify task continues in background after AI session closes, session binding cleaned up, reconnect via status works (FR-019) in src/orchestrator/reporter.ts
- [ ] T099 Edge case: multiple specify in same session - reject second /agentic.specify when session already bound to active task, display error with current task ID in src/cli/commands/specify.ts
- [ ] T100 [P] Add comprehensive JSDoc documentation to all public APIs in src/
- [ ] T101 Performance validation: ensure task startup < 30s, classification < 5s, status query < 2s
- [ ] T102 Run quickstart.md validation: execute all documented scenarios end-to-end
- [ ] T103 Implement package entry point with re-exports of public API in src/index.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories. **This is the MVP.** Includes session lifecycle (reporter, background execution).
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Extends US1 components (TaskManager, Dispatcher, Orchestrator) but should be independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Extends Orchestrator loop but should be independently testable
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Uses TaskHistory from US1 scoring flow, but mediator module is independent
- **User Story 5 (P3)**: Depends on US1 session reporter (Phase 3) - Extends it for reconnection and active task listing

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Types before stores
- Stores before managers/services
- Managers/services before orchestrator extensions
- Core implementation before CLI commands
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T003, T004, T005)
- All type definition tasks in Phase 2 marked [P] can run in parallel (T006-T011)
- Configuration tasks T013 can run in parallel with storage tasks (different modules)
- Utility tasks T018, T019, T020 can all run in parallel
- Foundational tests T022, T023, T024 can all run in parallel
- All tests within a user story marked [P] can run in parallel
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- US5 depends on US1's session reporter; other stories remain independent

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (TDD - write tests first):
Task: T025 "Unit test for TaskClassifier in tests/unit/task/classifier.test.ts"
Task: T026 "Unit test for TaskManager in tests/unit/task/manager.test.ts"
Task: T027 "Unit test for TaskQueue in tests/unit/task/queue.test.ts"
Task: T028 "Unit test for AgentLoader in tests/unit/agents/loader.test.ts"
Task: T029 "Unit test for AgentRegistry in tests/unit/agents/registry.test.ts"
Task: T030 "Unit test for Scorer evaluator in tests/unit/scorer/evaluator.test.ts"
Task: T031 "Unit test for Orchestrator main loop in tests/unit/orchestrator/loop.test.ts"
Task: T032 "Unit test for Session reporter in tests/unit/orchestrator/reporter.test.ts"
Task: T033 "Integration test for task flow in tests/integration/task-flow.test.ts"
Task: T034 "Integration test for session lifecycle in tests/integration/session-lifecycle.test.ts"

# Then launch independent implementation tasks:
Task: T035 "Agent loader in src/agents/loader.ts"       # [P] can run with T038
Task: T038 "Task classifier in src/task/classifier.ts"   # [P] can run with T035
Task: T042 "Scorer evaluator in src/scorer/evaluator.ts" # [P] can run with T035, T038
```

---

## Parallel Example: User Stories in Parallel

```bash
# After Foundational (Phase 2) is complete, different developers can work on:
Developer A: Phase 3 (US1 - Basic Task Loop + Session Lifecycle)  # P1 MVP
Developer B: Phase 6 (US4 - Mediator Intervention)                # P3, independent module
Developer C: Phase 7 (US5 - Reconnection & Monitoring)            # P3, depends on US1 reporter

# US2 and US3 extend US1 orchestrator, so best done after US1 or by same developer
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Run: `agentic init` → creates config and directories
   - Run: `agentic specify "生成一个 README 文件"` → task created, AI session enters polling mode with 10s progress updates
   - Verify: task classified, assigned, executed, scored, result returned in same session
   - Verify: retry on reject works (up to 3 times)
   - Verify: closing session does not stop the task (background execution)
5. Deploy/demo if ready - **this is the MVP**

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (**MVP!** includes session lifecycle)
3. Add User Story 2 → Test delegation → Deploy/Demo (multi-agent support)
4. Add User Story 3 → Test interaction → Deploy/Demo (user input support)
5. Add User Story 4 → Test mediation → Deploy/Demo (self-healing)
6. Add User Story 5 → Test reconnection → Deploy/Demo (full observability + reconnection)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (MVP, highest priority, includes session reporter)
   - Developer B: User Story 4 (independent mediator module)
   - Developer C: User Story 5 (depends on US1 reporter, can start CLI scaffolding in parallel)
3. After US1 is done:
   - Developer A: User Story 2 (extends orchestrator)
   - Developer B: User Story 3 (extends orchestrator)
   - Developer C: User Story 5 reconnection (now has US1 reporter available)
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- TDD: Write tests first, verify they fail, then implement
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Tech stack: citty (CLI), unstorage (storage), c12 (config), hookable (events), consola (logging), vitest (tests)
- All state persisted via unstorage with fs driver (configurable)
- FSM + event log for task state management (per research.md decision)
- Rule engine + heuristics for scoring (per research.md decision)
- CBR + rules for mediation (per research.md decision)
- Promise pool for concurrency control (per research.md decision)
- Session reporter handles AI session binding and progress polling (per spec.md session lifecycle)
- Tasks run in background, decoupled from session lifecycle (per FR-019)
