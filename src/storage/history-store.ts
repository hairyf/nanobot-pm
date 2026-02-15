import type { Storage } from 'unstorage'
import type { Mediation } from '../mediator/types'
import type { Score } from '../scorer/types'
import type { TaskEvent, TaskHistory, TaskStatistics } from '../task/types'
import type { HistoryStoreInterface } from './types'

const HISTORY_PREFIX = 'history:'

function createEmptyHistory(taskId: string): TaskHistory {
  return {
    taskId,
    events: [],
    scores: [],
    mediations: [],
    statistics: {
      totalDuration: 0,
      executionDuration: 0,
      waitingDuration: 0,
      retryCount: 0,
      scoreCount: 0,
      mediationCount: 0,
    },
  }
}

export class HistoryStore implements HistoryStoreInterface {
  constructor(private storage: Storage) {}

  async appendEvent(taskId: string, event: TaskEvent): Promise<void> {
    const key = `${HISTORY_PREFIX}${taskId}`
    const history = (await this.storage.getItem<TaskHistory>(key)) ?? createEmptyHistory(taskId)
    history.events.push(event)
    await this.storage.setItem(key, history)
  }

  async getHistory(taskId: string): Promise<TaskHistory | undefined> {
    const key = `${HISTORY_PREFIX}${taskId}`
    const history = await this.storage.getItem<TaskHistory>(key)
    return history ?? undefined
  }

  async getStatistics(taskId: string): Promise<TaskStatistics | undefined> {
    const history = await this.getHistory(taskId)
    return history?.statistics
  }

  async appendScore(taskId: string, score: Score): Promise<void> {
    const key = `${HISTORY_PREFIX}${taskId}`
    const history = (await this.storage.getItem<TaskHistory>(key)) ?? createEmptyHistory(taskId)
    history.scores.push(score)
    history.statistics.scoreCount = history.scores.length
    await this.storage.setItem(key, history)
  }

  async appendMediation(taskId: string, mediation: Mediation): Promise<void> {
    const key = `${HISTORY_PREFIX}${taskId}`
    const history = (await this.storage.getItem<TaskHistory>(key)) ?? createEmptyHistory(taskId)
    history.mediations.push(mediation)
    history.statistics.mediationCount = history.mediations.length
    await this.storage.setItem(key, history)
  }
}
