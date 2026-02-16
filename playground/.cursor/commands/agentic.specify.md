---
description: Create and execute a task via the agentic orchestrator
---

## Task

```text
$ARGUMENTS
```

## Steps

### 1. Analyze agents

Read all `.md` files in the agents directory (e.g. `.cursor/agents/`).
Each file has frontmatter (`name`, `description`) and Markdown sections (`Capabilities`, `Specialties`).
Based on the task description, decide which agent is best suited for the job.

### 2. Register, assign, and launch

Run the following command (one step — registers the task, assigns the agent, and launches a Cloud Agent):

```bash
pnpm agentic specify <agentId> "$ARGUMENTS"
```

Parse the JSON output and save `taskId` for subsequent steps.

### 3. Poll status

Continuously poll the task status until it reaches a terminal state:

```bash
pnpm agentic status <taskId> --json
```

- If `status` is `running`, wait a few seconds and poll again.
- If `status` is `completed`, report the result (including score and summary) to the user.
- If `status` is `failed`, report the error to the user.
