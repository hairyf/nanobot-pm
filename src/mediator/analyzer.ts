import type { Score } from '../scorer/types'
import type { HistoryStoreInterface } from '../storage/types'
import type { Task, TaskHistory } from '../task/types'
import type { Diagnosis, ProblemType } from './types'

export class MediatorAnalyzer {
  constructor(private historyStore: HistoryStoreInterface) {}

  async diagnose(task: Task, history: TaskHistory): Promise<Diagnosis> {
    // Check for loop: 3+ rejections with similar feedback
    const loopDiagnosis = this.checkLoop(history)
    if (loopDiagnosis) {
      return loopDiagnosis
    }

    // Check for timeout
    const timeoutDiagnosis = this.checkTimeout(task)
    if (timeoutDiagnosis) {
      return timeoutDiagnosis
    }

    // Check for error: events contain 'failed' type
    const errorDiagnosis = this.checkError(history)
    if (errorDiagnosis) {
      return errorDiagnosis
    }

    // Check for dependency: child tasks failed
    const dependencyDiagnosis = await this.checkDependency(task)
    if (dependencyDiagnosis) {
      return dependencyDiagnosis
    }

    // Default: unknown
    return {
      problemType: 'unknown',
      symptoms: ['No specific pattern detected'],
      context: {},
    }
  }

  private checkLoop(history: TaskHistory): Diagnosis | null {
    const scores = history.scores as Score[]
    const rejections = scores.filter(s => s.result === 'reject')

    if (rejections.length < 3) {
      return null
    }

    // Check if rejections have similar feedback
    // Group by normalized feedback (lowercase, trimmed)
    const feedbackGroups = new Map<string, Score[]>()
    for (const rejection of rejections) {
      const normalized = rejection.feedback.toLowerCase().trim()
      const group = feedbackGroups.get(normalized) || []
      group.push(rejection)
      feedbackGroups.set(normalized, group)
    }

    // Check if any group has 3+ rejections
    for (const [feedback, group] of feedbackGroups) {
      if (group.length >= 3) {
        return {
          problemType: 'loop',
          symptoms: [
            'Multiple rejections with same error',
            `Rejection count: ${group.length}`,
            `Feedback pattern: "${feedback.substring(0, 100)}${feedback.length > 100 ? '...' : ''}"`,
          ],
          context: {
            rejectionCount: group.length,
            totalRejections: rejections.length,
            feedbackPattern: feedback,
          },
        }
      }
    }

    // If we have 3+ rejections but different feedback, still consider it a loop
    if (rejections.length >= 3) {
      return {
        problemType: 'loop',
        symptoms: [
          'Multiple rejections with same error',
          `Rejection count: ${rejections.length}`,
        ],
        context: {
          rejectionCount: rejections.length,
        },
      }
    }

    return null
  }

  private checkTimeout(task: Task): Diagnosis | null {
    if (!task.startedAt) {
      return null
    }

    const duration = Date.now() - task.startedAt
    if (duration > task.timeout) {
      return {
        problemType: 'timeout',
        symptoms: ['Task duration exceeds timeout limit'],
        context: {
          duration,
          timeout: task.timeout,
          exceededBy: duration - task.timeout,
        },
      }
    }

    return null
  }

  private checkError(history: TaskHistory): Diagnosis | null {
    const failedEvents = history.events.filter(e => e.type === 'failed')
    if (failedEvents.length === 0) {
      return null
    }

    // Get error details from the most recent failed event
    const latestFailed = failedEvents[failedEvents.length - 1]
    if (latestFailed.type === 'failed') {
      return {
        problemType: 'error',
        symptoms: ['Task execution failed', latestFailed.error.message],
        rootCause: latestFailed.error.message,
        context: {
          errorCode: latestFailed.error.code,
          errorMessage: latestFailed.error.message,
          recoverable: latestFailed.error.recoverable,
          failedEventCount: failedEvents.length,
        },
      }
    }

    return null
  }

  private async checkDependency(task: Task): Promise<Diagnosis | null> {
    if (task.childTaskIds.length === 0) {
      return null
    }

    const failedChildTasks: string[] = []
    for (const childTaskId of task.childTaskIds) {
      const childHistory = await this.historyStore.getHistory(childTaskId)
      if (childHistory) {
        const hasFailed = childHistory.events.some(e => e.type === 'failed')
        if (hasFailed) {
          failedChildTasks.push(childTaskId)
        }
      }
    }

    if (failedChildTasks.length > 0) {
      return {
        problemType: 'dependency',
        symptoms: [
          'Child tasks failed',
          `Failed child tasks: ${failedChildTasks.join(', ')}`,
        ],
        context: {
          failedChildTasks,
          totalChildTasks: task.childTaskIds.length,
        },
      }
    }

    return null
  }
}
