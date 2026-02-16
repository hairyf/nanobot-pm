import { consola } from 'consola'

export const logger = consola.withTag('agentic')

export function taskCreated(taskId: string, description: string) {
  logger.info('task:created', { taskId, description })
}

export function taskAssigned(taskId: string, agentId: string) {
  logger.info('task:assigned', { taskId, agentId })
}

export function scoreSubmitted(taskId: string, result: unknown, scorerId: string) {
  logger.info('score:submitted', { taskId, result, scorerId })
}

export function mediationTriggered(taskId: string, problemType: string) {
  logger.warn('mediation:triggered', { taskId, problemType })
}

export function taskCompleted(taskId: string, duration: number) {
  logger.info('task:completed', { taskId, duration })
}

export function taskFailed(taskId: string, error: unknown) {
  logger.error('task:failed', { taskId, error })
}
