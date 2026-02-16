import process from 'node:process'
import { defineCommand } from 'citty'
import { join } from 'pathe'
import { syncTranscriptToLog } from '../../agents/transcript-sync'
import { UserQueryManager } from '../../task/user-query'
import { createCliContext } from '../helpers'
import { formatDuration, formatStatus, formatUserQuery, outputJson } from '../utils'

/** Statuses that cause wait to exit and return to the caller. */
const EXIT_STATUSES = new Set(['completed', 'failed', 'cancelled', 'waiting_user'])

export const waitCommand = defineCommand({
  meta: {
    name: 'wait',
    description: 'Block until task reaches a terminal state (completed/failed/cancelled) or waiting_user',
  },
  args: {
    taskId: {
      type: 'positional',
      description: 'Task ID to wait for',
      required: true,
    },
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      required: false,
    },
    interval: {
      type: 'string',
      description: 'Poll interval in seconds (default: 5)',
      required: false,
    },
    timeout: {
      type: 'string',
      description: 'Max wait time in seconds (default: 1800)',
      required: false,
    },
  },
  async run({ args }) {
    const taskId = args.taskId as string
    const jsonMode = args.json as boolean | undefined
    const pollInterval = Number(args.interval || '5') * 1000
    const maxWait = Number(args.timeout || '1800') * 1000

    const ctx = await createCliContext()
    const startTime = Date.now()

    // Get initial status
    const initialTask = await ctx.taskStore.get(taskId)
    if (!initialTask) {
      outputJson({ success: false, error: `Task not found: ${taskId}` })
      process.exit(1)
    }

    // If already in an exit status, show and exit immediately
    if (EXIT_STATUSES.has(initialTask.status)) {
      await showTaskResult(ctx, taskId, jsonMode)
      process.exit(0)
    }

    // Poll until status reaches an exit status
    // Note: waiting_eval and running are NOT exit statuses — keep polling through them
    while (Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      const task = await ctx.taskStore.get(taskId)
      if (!task) {
        outputJson({ success: false, error: `Task disappeared: ${taskId}` })
        process.exit(1)
      }

      if (EXIT_STATUSES.has(task.status)) {
        await showTaskResult(ctx, taskId, jsonMode)
        process.exit(0)
      }
    }

    // Timeout — show current status and exit with error
    await showTaskResult(ctx, taskId, jsonMode)
    if (jsonMode) {
      outputJson({ success: false, error: `Timeout after ${maxWait / 1000}s waiting for task to complete` })
    }
    else {
      console.log(`\n⏰ Timeout after ${formatDuration(maxWait)} waiting for task to complete`)
    }
    process.exit(1)
  },
})

async function showTaskResult(
  ctx: Awaited<ReturnType<typeof createCliContext>>,
  taskId: string,
  jsonMode: boolean | undefined,
): Promise<void> {
  const { config, storage, taskStore, historyStore } = ctx
  const task = await taskStore.get(taskId)
  if (!task) {
    outputJson({ success: false, error: `Task not found: ${taskId}` })
    return
  }

  // Auto-sync transcript → log file for delegated (running) tasks
  const sessionId = task.metadata?.sessionId as string | undefined
  let transcriptSynced = 0
  if (sessionId) {
    const logFile = join(config.storage.basePath, 'logs', `${task.id}.log`)
    transcriptSynced = syncTranscriptToLog(sessionId, logFile)
  }

  const history = await historyStore.getHistory(taskId)

  // If task is waiting_user, include the pending query
  let pendingQuery
  if (task.status === 'waiting_user') {
    const queryManager = new UserQueryManager(storage)
    const query = await queryManager.getQueryByTask(taskId)
    if (query) {
      pendingQuery = {
        queryId: query.id,
        question: query.question,
        options: query.options,
        context: query.context,
        createdAt: query.createdAt,
      }
    }
  }

  if (jsonMode) {
    outputJson({
      success: true,
      data: {
        task: {
          id: task.id,
          description: task.description,
          type: task.type,
          status: task.status,
          assignedAgent: task.assignedAgent,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          retryCount: task.retryCount,
          maxRetries: task.maxRetries,
        },
        events: history?.events || [],
        scores: history?.scores || [],
        ...(transcriptSynced > 0 && { transcriptSynced }),
        ...(pendingQuery && { pendingQuery }),
      },
    })
  }
  else {
    const elapsed = Date.now() - task.createdAt
    console.log(`\nTask: ${task.id}`)
    console.log(`Description: ${task.description}`)
    console.log(`Status: ${formatStatus(task.status)}`)
    console.log(`Agent: ${task.assignedAgent || '(unassigned)'}`)
    console.log(`Elapsed: ${formatDuration(elapsed)}`)
    console.log(`Retries: ${task.retryCount}/${task.maxRetries}`)

    // Show pending query for waiting_user tasks
    if (pendingQuery) {
      console.log(formatUserQuery({ question: pendingQuery.question, options: pendingQuery.options }))
      console.log(`  Reply with: pnpm agentic respond ${task.id} --answer "<your answer>"`)
    }

    // Show scorer info for waiting_eval tasks
    if (task.status === 'waiting_eval') {
      const scorerSessionId = task.metadata?.scorerSessionId as string | undefined
      console.log(`\nEvaluation in progress...`)
      if (scorerSessionId) {
        console.log(`Scorer session: ${scorerSessionId}`)
      }
    }

    // Show last scorer feedback for retried tasks
    const lastFeedback = task.metadata?.lastScorerFeedback as string | undefined
    if (lastFeedback) {
      console.log(`\nLast scorer feedback: ${lastFeedback}`)
      const lastSuggestions = task.metadata?.lastScorerSuggestions as string | undefined
      if (lastSuggestions) {
        console.log(`Suggestions: ${lastSuggestions}`)
      }
    }

    if (history?.events && history.events.length > 0) {
      console.log(`\nEvents (${history.events.length}):`)
      for (const event of history.events) {
        const ts = new Date(event.timestamp).toLocaleTimeString()
        console.log(`  ${ts} - ${event.type}`)
      }
    }
  }
}
