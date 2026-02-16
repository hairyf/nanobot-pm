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

### 3. Wait for completion

Run the blocking wait command — it will block until the task reaches a terminal state:

```bash
pnpm agentic wait <taskId>
```

This command blocks until the task reaches a terminal state (`completed`, `failed`, `cancelled`) or `waiting_user`.

- If `status` is `completed`, report the result (including score and summary) to the user.
- If `status` is `failed`, report the error to the user.
- If `status` is `waiting_user`, the JSON output will include a `pendingQuery` field with the question and options. Present the question to the user, collect their answer, then submit it and re-run wait:
  ```bash
  pnpm agentic respond <taskId> --answer "<user's answer>"
  pnpm agentic wait <taskId>
  ```
- If the command exits with a timeout, re-run `pnpm agentic wait <taskId>` to continue waiting.
