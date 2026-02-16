import process from 'node:process'
import { defineCommand } from 'citty'
import { join } from 'pathe'
import { syncTranscriptToLog } from '../../agents/transcript-sync'
import { UserQueryManager } from '../../task/user-query'
import { createCliContext } from '../helpers'
import { formatDuration, formatStatus, formatTable, formatUserQuery, outputJson } from '../utils'

export const statusCommand = defineCommand({
  meta: {
    name: 'status',
    description: 'Check task status or start permanent monitoring',
  },
  args: {
    taskId: {
      type: 'positional',
      description: 'Task ID to check (omit for all tasks)',
      required: false,
    },
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      required: false,
    },
    watch: {
      type: 'boolean',
      description: 'Start permanent monitoring (outputs updates until manually stopped)',
      required: false,
    },
    interval: {
      type: 'string',
      description: 'Poll interval in seconds for --watch mode (default: 5)',
      required: false,
    },
  },
  async run({ args }) {
    const taskId = args.taskId as string | undefined
    const jsonMode = args.json as boolean | undefined
    const watchMode = args.watch as boolean | undefined
    const pollInterval = Number(args.interval || '5') * 1000

    const ctx = await createCliContext()

    if (taskId) {
      if (watchMode) {
        await watchTask(ctx, taskId, jsonMode, pollInterval)
      }
      else {
        await showTaskStatus(ctx, taskId, jsonMode)
      }
    }
    else {
      await showAllTasks(ctx, jsonMode)
    }
  },
})

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

/**
 * Permanent monitoring: continuously outputs task status updates
 * until the task reaches a terminal state or the process is killed.
 */
async function watchTask(
  ctx: Awaited<ReturnType<typeof createCliContext>>,
  taskId: string,
  jsonMode: boolean | undefined,
  pollInterval: number,
): Promise<void> {
  const task = await ctx.taskStore.get(taskId)
  if (!task) {
    outputJson({ success: false, error: `Task not found: ${taskId}` })
    process.exit(1)
  }

  let lastStatus = ''

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\nMonitoring stopped.')
    process.exit(0)
  })

  if (!jsonMode) {
    console.log(`\n👁️  Watching task ${taskId} (Ctrl+C to stop)\n`)
  }

  while (true) {
    const current = await ctx.taskStore.get(taskId)
    if (!current) {
      outputJson({ success: false, error: `Task disappeared: ${taskId}` })
      process.exit(1)
    }

    // Always output on status change, or periodically in JSON mode
    if (current.status !== lastStatus || jsonMode) {
      if (jsonMode) {
        outputJson({
          success: true,
          data: {
            task: {
              id: current.id,
              status: current.status,
              assignedAgent: current.assignedAgent,
              updatedAt: current.updatedAt,
              retryCount: current.retryCount,
            },
            watching: true,
          },
        })
      }
      else {
        const elapsed = formatDuration(Date.now() - current.createdAt)
        const ts = new Date().toLocaleTimeString()
        console.log(`[${ts}] ${formatStatus(current.status)} | Agent: ${current.assignedAgent || '-'} | Elapsed: ${elapsed} | Retries: ${current.retryCount}/${current.maxRetries}`)
      }

      lastStatus = current.status
    }

    // Stop watching when task reaches a terminal state
    if (TERMINAL_STATUSES.has(current.status)) {
      if (!jsonMode) {
        console.log(`\nTask reached terminal state: ${current.status}`)
      }
      await showTaskStatus(ctx, taskId, jsonMode)
      process.exit(0)
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }
}

async function showTaskStatus(
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
    console.log(`Type: ${task.type}`)
    console.log(`Status: ${formatStatus(task.status)}`)
    console.log(`Agent: ${task.assignedAgent || '(unassigned)'}`)
    console.log(`Created: ${new Date(task.createdAt).toLocaleString()}`)
    console.log(`Elapsed: ${formatDuration(elapsed)}`)
    console.log(`Retries: ${task.retryCount}/${task.maxRetries}`)
    if (sessionId) {
      console.log(`Session: ${sessionId}`)
    }
    if (transcriptSynced > 0) {
      console.log(`Transcript: ${transcriptSynced} new entries synced to log`)
    }

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

async function showAllTasks(
  ctx: Awaited<ReturnType<typeof createCliContext>>,
  jsonMode: boolean | undefined,
): Promise<void> {
  const { taskStore } = ctx
  const tasks = await taskStore.list()

  if (tasks.length === 0) {
    console.log('No tasks found.')
    return
  }

  if (jsonMode) {
    outputJson({
      success: true,
      data: {
        tasks: tasks.map(t => ({
          id: t.id,
          description: t.description,
          type: t.type,
          status: t.status,
          assignedAgent: t.assignedAgent,
          createdAt: t.createdAt,
        })),
        total: tasks.length,
      },
    })
  }
  else {
    const rows = tasks
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(t => [
        t.id.slice(0, 8),
        formatStatus(t.status),
        t.assignedAgent || '-',
        t.description.length > 40 ? `${t.description.slice(0, 37)}...` : t.description,
        formatDuration(Date.now() - t.createdAt),
      ])

    console.log(`\n${formatTable(
      ['ID', 'Status', 'Agent', 'Description', 'Age'],
      rows,
    )}`)
    console.log(`\nTotal: ${tasks.length} task(s)`)
  }
}
