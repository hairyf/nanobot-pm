# 澄清后跨文档同步检查：多层级 Agent 循环器

**Purpose**: 验证 2026-02-15 澄清会话中 4 条新增澄清（in-process 通信、consola 日志、SC-007 量化、状态机模型）是否已正确同步到所有相关文档
**Created**: 2026-02-15
**Feature**: [spec.md](../spec.md)
**Focus**: 跨文档一致性（澄清后同步）
**Depth**: 标准
**Audience**: 开发者（实现前自检）

---

## 澄清 1：Agent 通信协议 — in-process 函数调用

- [x] CHK001 - ~~plan.md 主要依赖中 `ofetch` 描述为 "HTTP 客户端，用于 Agent 通信"~~ ✅ 已删除 ofetch Agent 通信描述
- [x] CHK002 - ~~plan.md 原则 V 中列出 `ofetch (HTTP)`~~ ✅ 已从原则列表中移除
- [x] CHK003 - ~~plan.md 依赖版本列表中 `ofetch: ^1.3.0`~~ ✅ 已从依赖列表中移除
- [x] CHK004 - ~~tasks.md T002 安装依赖中包含 `ofetch`~~ ✅ 已从 T002 依赖列表中移除（plan.md 主要依赖已不包含 ofetch）
- [x] CHK005 - ~~plan.md 研究任务中提到 "线程池 vs Worker 线程 vs 进程池"~~ ✅ 已标注为已决策：in-process 函数调用
- [x] CHK006 - ~~research.md 中 "拒绝理由：当前场景是进程内通信"（L173）~~ ✅ 与 spec.md 假设章节 in-process 声明一致
- [x] CHK007 - ~~data-model.md Agent 实体缺少 in-process 通信约束~~ ✅ 已在 Agent 实体描述中添加 in-process 函数调用通信说明
- [x] CHK008 - ~~quickstart.md 是否暗示 HTTP/远程通信~~ ✅ 通过：所有示例均为 CLI 命令和本地文件操作，未暗示 HTTP/远程通信
- [x] CHK009 - ~~full-review.md CHK060 仍标记为"低优先级"~~ ✅ 已更新为已澄清
- [x] CHK010 - ~~contracts/ 中 API JSON 契约暗示 HTTP REST 接口~~ ✅ 已在 task-api.json、scorer-api.json、mediator-api.json 的 description 中添加说明：定义 in-process 函数签名，HTTP 表示法仅为描述约定

## 澄清 2：状态机执行模型

- [x] CHK011 - ~~plan.md 是否需要在架构概述中明确记录 "持久化状态机模型"~~ ✅ 已在原则 V 和约束中记录
- [x] CHK012 - ~~plan.md 研究任务 1 结论未提及持久化状态机步进~~ ✅ 已在研究任务 1 中补充决策结论：FSM + 事件日志 + 持久化状态机步进，与 spec.md 假设对齐
- [x] CHK013 - ~~data-model.md Task 缺少事件驱动状态机步进模型说明~~ ✅ 已在 Task 实体 TaskStatus 定义后添加"执行模型：事件驱动的状态机步进"完整说明（加载→执行→持久化→退出）
- [x] CHK014 - ~~tasks.md 缺少状态机步进引擎实现覆盖~~ ✅ 已在 T039（TaskManager FSM）和 T048（编排器主循环）中补充持久化状态机步进模型描述

## 澄清 3：可观测性 — 仅 consola 控制台日志

- [x] CHK015 - ~~plan.md 是否需要在约束中明确可观测性限制~~ ✅ 已在约束中添加
- [x] CHK016 - ~~tasks.md T018 未列出关键操作日志点~~ ✅ 已在 T018 中补充所有 spec 要求的关键操作日志点辅助函数（task:created/assigned、score:submitted、mediation:triggered、task:completed/failed）
- [x] CHK017 - ~~full-review.md CHK051 仍标记为"低优先级"~~ ✅ 已更新为已澄清

## 澄清 4：SC-007 性能量化 — 延迟增加不超过 50%

- [x] CHK018 - ~~plan.md §性能目标仅写 "支持 5 个并发任务"~~ ✅ 已同步为"支持 5 个并发任务，单任务延迟增加不超过 50%"
- [x] CHK019 - ~~plan.md §约束中是否需要添加延迟量化约束~~ ✅ 已添加到约束列表
- [x] CHK020 - ~~tasks.md 缺少 SC-007 并发延迟对比测试~~ ✅ 已在 T101 中扩展 SC-007 验收测试：5 并发任务下单任务操作延迟增加不超过 50%（与单任务基线对比）
- [x] CHK021 - ~~full-review.md CHK039 仍标记为"低优先级"~~ ✅ 已更新为已澄清

## 综合一致性

- [x] CHK022 - ~~spec.md 澄清记录格式一致性~~ ✅ 通过：所有 12 条澄清记录均使用一致的 Q→A 格式（"Q: ... → A: ..."）
- [x] CHK023 - ~~spec.md 假设章节新增假设合并了两个概念~~ ✅ 已拆分为两条独立假设：(1) in-process 函数调用通信 (2) 持久化状态机模型，与现有假设风格一致
- [x] CHK024 - ~~quickstart.md 配置示例中 `storage.driver: 'fs/redis/sqlite'`~~ ✅ 通过：unstorage 配置前端储存方式，默认为 fs（文件储存），本地范围符合

---

## 统计

| 类别 | 项数 |
|------|------|
| 澄清 1：通信协议同步 | 10 |
| 澄清 2：状态机模型同步 | 4 |
| 澄清 3：可观测性同步 | 3 |
| 澄清 4：性能量化同步 | 4 |
| 综合一致性 | 3 |
| **合计** | **24** |

## Notes

- 本检查清单验证的是**需求文档之间的一致性**，而非实现的正确性
- 标记 `[Conflict]` 表示文档间存在直接矛盾
- 标记 `[Consistency]` 表示可能的不一致
- 标记 `[Completeness]` 表示信息缺失
- 标记 `[Coverage]` 表示任务覆盖不足
- 标记 `[Clarity]` 表示表述可能引起误解
- **关键冲突**: ~~CHK001/CHK002 — plan.md 中 ofetch 用途描述与 in-process 澄清直接矛盾~~ ✅ 已全部解决
