# 全面需求质量审查：多层级 Agent 循环器

**Purpose**: 实现前自检 — 验证所有规格文档（spec、plan、data-model、contracts、quickstart、tasks）的完整性、清晰度、一致性和跨文档同步
**Created**: 2026-02-15
**Feature**: [spec.md](../spec.md)
**Focus**: 全面需求质量审查，特别关注会话生命周期澄清后的跨文档同步
**Depth**: 标准
**Audience**: 开发者（实现前自检）
**Last Updated**: 2026-02-15 (澄清后修复)

---

## 跨文档同步一致性

- [x] CHK001 - ~~data-model.md 中是否定义了 SessionBinding 实体？~~ ✅ 已添加 SessionBinding 实体（含 sessionId、taskId、status、pollInterval、boundAt、lastActiveAt、disconnectedAt）
- [x] CHK002 - ~~task-api.json 契约中是否包含会话相关的 API？~~ ✅ 已添加 bindSession (POST) 和 unbindSession (DELETE) 端点及 SessionBinding definition
- [x] CHK003 - ~~data-model.md 的 TaskEvent 类型联合中是否包含会话相关事件？~~ ✅ 已添加 session_bound、session_disconnected、session_reconnected 事件
- [x] CHK004 - ~~quickstart.md 中 Agent 定义目录使用 `.agentic/agents/`~~ ✅ 已统一为 AI Agents 环境标准目录（.cursor/agents/、.claude/agents/），配置通过 agents.directories 指定
- [x] CHK005 - ~~quickstart.md 提到 `agentic history` 独立命令~~ ✅ 已改为 `agentic status <id> --history`（status 子功能）
- [x] CHK006 - ~~quickstart.md 提到 `agentic agents list` 和 `agentic agents stats` 命令~~ ✅ 已改为 `agentic init --check` 和 `agentic status <id> --history`
- [ ] CHK007 - quickstart.md 提到 `agentic status --watch` 持续监控标志，但 spec.md 和 tasks.md 中未定义此 CLI 标志 — 保留为低优先级（status 默认就是轮询模式） [Gap, 低优先级]
- [x] CHK008 - ~~data-model.md 使用 Zod 但 plan.md 未列入依赖~~ ✅ 已添加 zod 到 plan.md 依赖和 tasks.md T002
- [x] CHK009 - ~~spec.md 关键实体列表与 data-model.md 不对齐~~ ✅ 已在 spec.md 关键实体中添加 SessionBinding，并丰富每个实体的属性描述
- [x] CHK010 - ~~data-model.md 和 contracts/ 中无 Session 相关数据结构~~ ✅ 已添加 SessionBinding 实体、存储键 sessions:{session-id}、索引 index:session:{session-id}
- [x] CHK011 - ~~spec.md "每 10 秒（可配置）" 未指定配置字段~~ ✅ FR-012 已更新为 `orchestrator.pollInterval`，默认 10 秒
- [x] CHK012 - ~~tasks.md T010 未包含 pollInterval~~ ✅ T010 已更新包含 OrchestratorConfig（含 pollInterval）和 SessionBinding 完整字段

## 需求完整性

- [x] CHK013 - ~~评分冲突边缘情况无对应 FR~~ ✅ 已澄清：当前版本采用单评分者模式，边缘情况已更新
- [x] CHK014 - ~~资源耗尽边缘情况无对应 FR~~ ✅ 已添加 FR-024（内存超阈值暂停接受新任务）和 tasks.md T101a
- [x] CHK015 - ~~Agent 崩溃恢复无 FR 定义检测机制~~ ✅ 已添加 FR-023（心跳超时 30 秒检测）和 tasks.md T100
- [x] CHK016 - ~~网络中断无具体恢复策略~~ ✅ 已在边缘情况中明确：每次状态变更持久化到 unstorage，恢复后从最后持久化状态继续
- [x] CHK017 - ~~FR-018 初始化命令未指定具体内容~~ ✅ FR-018 已更新：创建 agentic.config.ts 和存储目录
- [x] CHK018 - ~~评分者类型未在 spec.md 中明确~~ ✅ FR-005 已更新：包含 rule/heuristic/manual 三种类型
- [ ] CHK019 - spec.md 未定义评分规则的配置格式 — 保留为低优先级（可在实现阶段通过 scorer config schema 定义） [Gap, 低优先级]
- [x] CHK020 - ~~UserQuery 超时行为不完整~~ ✅ 已统一为无限期等待，定期（24 小时）发送提醒
- [x] CHK021 - ~~任务取消副作用未定义~~ ✅ FR-016 已更新：取消父任务时所有未完成子任务也被取消
- [ ] CHK022 - spec.md 中未定义任务历史自动清理机制 — 保留为低优先级（SC-008 已定义保留 30 天） [Gap, 低优先级]

## 需求清晰度

- [x] CHK023 - ~~FR-003 任务类型判断标准模糊~~ ✅ 已更新：先匹配 Agent 能力标签，多专长为 downstream，含决策点为 inquiry
- [x] CHK024 - ~~FR-004 "合适的 Agent" 匹配标准模糊~~ ✅ 已更新：按 capabilities 与任务关键词重合度排序，优先空闲 Agent
- [x] CHK025 - ~~SC-003 "简单任务" 定义模糊~~ ✅ 已更新：类型为 local、单 Agent 完成、无子任务委派
- [x] CHK026 - ~~评分冲突"多个评分者"机制不明~~ ✅ 已澄清：当前版本单评分者模式
- [x] CHK027 - ~~假设"评分标准是明确的"过于模糊~~ ✅ 已更新：评分标准通过 agentic.config.ts 中 scorer 部分定义
- [x] CHK028 - ~~调节者运行机制不清晰~~ ✅ FR-009 已更新：基于 CBR 案例推理 + 规则引擎
- [x] CHK029 - ~~FR-015 Agent 推断算法未定义~~ ✅ 已更新：基于任务描述关键词推断所需能力

## 需求一致性

- [x] CHK030 - ~~命令格式不一致~~ ✅ 已在 spec.md FR 部分添加说明：AI 环境用点号格式，CLI 用空格格式，功能等价
- [x] CHK031 - ~~Agent 目录路径三处不一致~~ ✅ 统一为 AI Agents 环境标准目录，quickstart 已修复，配置通过 agents.directories 指定
- [ ] CHK032 - spec.md US1.4"重新分配给原 Agent"与 US4 调节者"重新分配给更有经验的 Agent"— 不矛盾：US1.4 是普通驳回（回原 Agent），US4 是 3 次驳回后调节者介入才可能换 Agent [Consistency, 已澄清无需修改]
- [x] CHK033 - ~~spec.md 中未提到深度限制~~ ✅ 已在 US2 术语说明和边缘情况中添加"最大深度 10 层"
- [ ] CHK034 - 并发任务限制默认值 5 已在 spec、plan、quickstart 中一致 — 无需修改 [Consistency, 已一致]
- [ ] CHK035 - "评分者"/"Scorer 评估器" 术语差异 — 低优先级，不影响实现理解 [Terminology, 低优先级]

## 验收标准质量

- [ ] CHK036 - SC-001"开始处理"定义 — 低优先级（隐含为任务状态变为 running） [Measurability, 低优先级]
- [x] CHK037 - ~~SC-006 Agent 崩溃检测机制未定义~~ ✅ 已通过 FR-023 和边缘情况明确：心跳超时 30 秒检测
- [x] CHK038 - ~~SC-009 与 US3.4 矛盾~~ ✅ 已统一为无限期等待，US3.4 已修改
- [ ] CHK039 - SC-007"性能下降"量化标准 — 低优先级（可在性能测试阶段定义具体指标） [Measurability, 低优先级]
- [ ] CHK040 - SC-010"恢复"定义 — 已在边缘情况中澄清：从最后持久化状态继续 [Clarity, 已间接澄清]

## 场景覆盖

- [x] CHK041 - ~~竞争条件场景未定义~~ ✅ 已在边缘情况"Agent 崩溃恢复"中明确：拒绝已重分配任务的迟到提交
- [x] CHK042 - ~~子任务部分失败策略未定义~~ ✅ 已在 US2 验收场景 5 和边缘情况中添加
- [x] CHK043 - ~~评分者异常降级策略未定义~~ ✅ 已在边缘情况中添加"评分者异常"：降级为默认通过+标记"未评分"
- [ ] CHK044 - "调节者介入后仍失败"终止条件 — US4.4 已定义升级给用户，用户无法解决则任务标记为 failed [Coverage, 已隐含]
- [ ] CHK045 - tasks.md T089 已覆盖 FR-022 重连到 waiting_user 的流程 [Coverage, 已覆盖]

## 边缘情况覆盖

- [ ] CHK046 - "会话中多次 specify" 的错误码 — 低优先级（可在实现时定义 409 Conflict） [Edge Case, 低优先级]
- [x] CHK047 - ~~输入验证需求未定义~~ ✅ FR-001 已更新：描述不能为空且长度不超过 1000 字符
- [x] CHK048 - ~~描述长度限制在 spec 中缺失~~ ✅ 已通过 FR-001 同步
- [ ] CHK049 - 存储空间不足行为 — 低优先级（unstorage 会抛出标准 I/O 错误） [Edge Case, 低优先级]

## 非功能需求

- [ ] CHK050 - 独立 NFR 章节 — 建议后续添加，当前性能目标在 SC 中已覆盖 [Completeness, 延迟]
- [ ] CHK051 - 日志和可观测性需求 — 低优先级（consola 已在 tasks.md T018 中规划） [Gap, 低优先级]
- [ ] CHK052 - 数据安全需求 — 低优先级（本地文件系统存储，依赖操作系统权限） [Gap, 低优先级]
- [ ] CHK053 - 内存指标 — 已通过 FR-024 间接覆盖（500MB 阈值） [Gap, 已间接覆盖]

## 依赖与假设

- [ ] CHK054 - Agent 配置格式标准 — data-model.md Agent 接口即为标准 [Assumption, 已隐含]
- [x] CHK055 - ~~sources/claude-flow 依赖失效~~ ✅ 已更新为 hookable + c12 + unstorage
- [x] CHK056 - ~~"事件系统"与 hookable 对齐~~ ✅ 已明确内部依赖为 hookable

## 歧义与冲突

- [ ] CHK057 - 任务类型判断依据 — FR-003 已澄清为基于 Agent 能力标签匹配 + 任务描述分析 [Ambiguity, 已间接澄清]
- [x] CHK058 - ~~"下游任务"与"子任务"术语混用~~ ✅ 已统一为"子任务"（downstream task）
- [ ] CHK059 - FR-014/FR-020/FR-021 分拆 — 有意为之：FR-014 是基础查询，FR-020 是轮询恢复，FR-021 是列表功能，各有独立验收标准 [Duplication, 保留]
- [ ] CHK060 - Agent 通信协议（本地 vs HTTP） — 低优先级（当前基于本地文件系统，ofetch 用于可能的远程扩展） [Ambiguity, 低优先级]

---

## 修复统计

| 类别 | 总项数 | 已修复 | 保留/低优 | 修复率 |
|------|--------|--------|-----------|--------|
| 跨文档同步一致性 | 12 | 11 | 1 | 92% |
| 需求完整性 | 10 | 8 | 2 | 80% |
| 需求清晰度 | 7 | 7 | 0 | 100% |
| 需求一致性 | 6 | 3 | 3 | 50% |
| 验收标准质量 | 5 | 2 | 3 | 40% |
| 场景覆盖 | 5 | 3 | 2 | 60% |
| 边缘情况覆盖 | 4 | 2 | 2 | 50% |
| 非功能需求 | 4 | 0 | 4 | 0% |
| 依赖与假设 | 3 | 2 | 1 | 67% |
| 歧义与冲突 | 4 | 1 | 3 | 25% |
| **合计** | **60** | **39** | **21** | **65%** |

> 21 项保留/低优先级项均不影响核心实现，可在后续迭代中完善。

## Notes

- 本检查清单是**需求质量的单元测试**，验证需求文档本身的质量，而非实现的正确性
- 标记 `[Gap]` 表示需求中缺失的内容
- 标记 `[Conflict]` 表示跨文档不一致
- 标记 `[Ambiguity]` 表示表述模糊
- 标记 `[Consistency]` 表示一致性待验证
- 标记 `[Completeness]` 表示需求完整性问题
- 标记 `[Coverage]` 表示场景覆盖不足
- **关键修复**: 会话生命周期（SessionBinding）已完整同步到 spec、data-model、contracts、tasks
