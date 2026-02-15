<!--
  Sync Impact Report
  - Version change: 1.0.0 → 1.0.1 (语言中文化)
  - Modified principles: 无（仅翻译）
  - Added sections: 无
  - Removed sections: 无
  - Templates: plan-template.md ✅
  - Templates: spec-template.md ✅
  - Templates: tasks-template.md ✅
  - Follow-up TODOs: 无
-->

# Clawflow 项目宪法

## 核心原则

### I. 库优先（Library-First）
每个功能以独立、自包含的模块形式起步。包 MUST 可独立测试与文档化。明确用途——禁止仅用于组织结构的空库。理由：支持在 agent 工作流中的组合与复用。

### II. CLI 接口
核心功能 MUST 通过 CLI（`agentic` 命令）暴露。文本入/出协议：stdin/args → stdout，错误 → stderr。支持 JSON 与人类可读两种输出格式。理由：支持自动化、脚本化及与其他工具互操作。

### III. 测试优先（不可协商）
在实现之前或与实现同步编写测试。使用 Vitest 进行单元与集成测试。关键路径强制遵循 Red-Green-Refactor 周期。理由：确保正确性，支持安心重构。

### IV. 配置驱动（Config-Driven）
Agent 行为 MUST 可通过 `agentic.config.ts`（或等价方式）配置。使用 c12 加载配置。面向用户的行为不得硬编码默认值。理由：支持多种部署场景与用户定制。

### V. 简洁与 YAGNI
从简单开始，避免过度设计。第三次使用前不做抽象。通用 JS 优先采用 UnJS 生态（h3、nitro、ofetch、unstorage）。理由：降低维护负担，加速交付。

## 技术栈

- **运行时**：Node.js，ESM 优先
- **语言**：TypeScript 5.x
- **包管理**：pnpm，支持 workspace
- **测试**：Vitest
- **配置**：c12
- **存储**：unstorage（需持久化时）
- **CLI**：citty

## 开发流程

- PR 合并前 MUST 通过 lint 与测试
- `/speckit.plan` 的 Constitution Check 门禁中校验宪法合规
- 使用 `AGENTS.md` 作为 AI 辅助开发指引
- 提交信息在适用时采用 conventional commits

## 治理

本宪法优于临时约定。修订 MUST 记录：(1) 理由，(2) 迁移影响，(3) 按语义化版本规则升级版本。所有 PR/评审 SHOULD 验证原则合规。超出原则的复杂度 MUST 在 plan 的 Complexity Tracking 表中说明理由。使用 `AGENTS.md` 作为运行时开发指引。

**版本**：1.0.1 | **批准日**：2025-02-15 | **最后修订**：2025-02-15
