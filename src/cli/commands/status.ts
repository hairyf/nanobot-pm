import { defineCommand } from 'citty'
import { join } from 'pathe'
import { syncTranscriptToLog } from '../../agents/transcript-sync'
import { UserQueryManager } from '../../task/user-query'
import { createCliContext } from '../helpers'
import { formatDuration, formatStatus, formatTable, outputJson } from '../utils'

export const statusCommand = defineCommand({
  meta: {
    name: 'status',
    description: 'Check task status from internal storage',
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
  },
  async run({ args }) {
    const taskId = args.taskId as string | undefined
    const jsonMode = args.json as boolean | undefined

    const { config, storage, taskStore, historyStore } = await createCliContext()

    if (taskId) {
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

        if (history?.events && history.events.length > 0) {
          console.log(`\nEvents (${history.events.length}):`)
          for (const event of history.events) {
            const ts = new Date(event.timestamp).toLocaleTimeString()
            console.log(`  ${ts} - ${event.type}`)
          }
        }
      }
    }
    else {
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
  },
})
