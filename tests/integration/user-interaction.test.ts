import type { QueryOption } from '../../src/task/types'
import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseAppConfig } from '../../src/config/schema'
import { Orchestrator } from '../../src/orchestrator'
import { HistoryStore } from '../../src/storage/history-store'
import { UserQueryManager } from '../../src/task/user-query'
import { createMockAgent } from '../helpers'

describe('user interaction flow integration', () => {
  let orchestrator: Orchestrator
  let queryManager: UserQueryManager
  let historyStore: HistoryStore
  let storage: ReturnType<typeof createStorage>

  beforeEach(() => {
    storage = createStorage({ driver: memoryDriver() })
    const config = parseAppConfig({})
    orchestrator = new Orchestrator({ config, storage })

    // Create queryManager and historyStore for testing
    // In actual implementation, these will be part of Orchestrator
    queryManager = new UserQueryManager(storage)
    historyStore = new HistoryStore(storage)

    const agent = createMockAgent({
      id: 'dev-1',
      capabilities: ['coding', 'testing'],
      specialties: ['typescript'],
    })
    orchestrator.registry.register(agent)
  })

  describe('orchestrator pauses task when user input needed', () => {
    it('pauses inquiry task and creates user query', async () => {
      const taskId = await orchestrator.submitTask('Choose between MySQL or PostgreSQL')

      // Wait for orchestrator to process
      await new Promise(resolve => setTimeout(resolve, 100))

      const task = await orchestrator.taskManager.getTask(taskId)
      expect(task).toBeDefined()
      expect(task?.type).toBe('inquiry')
      expect(task?.status).toBe('waiting_user')

      // Verify query was created
      const query = await queryManager.getQueryByTask(taskId)
      expect(query).toBeDefined()
      expect(query?.question).toBeDefined()
      expect(query?.options).toBeDefined()
      expect(query?.options.length).toBeGreaterThan(0)
    })

    it('creates query with correct options for database choice', async () => {
      const taskId = await orchestrator.submitTask('Choose between MySQL or PostgreSQL')

      await new Promise(resolve => setTimeout(resolve, 100))

      const query = await queryManager.getQueryByTask(taskId)
      expect(query).toBeDefined()

      // Should have options for MySQL and PostgreSQL
      const optionLabels = query?.options.map(opt => opt.label.toLowerCase()) || []
      expect(
        optionLabels.some(label => label.includes('mysql') || label.includes('postgres')),
      ).toBe(true)
    })
  })

  describe('user response resumes task execution', () => {
    it('resumes task after user responds to query', async () => {
      const taskId = await orchestrator.submitTask('Choose between option A or B')

      await new Promise(resolve => setTimeout(resolve, 100))

      const task = await orchestrator.taskManager.getTask(taskId)
      expect(task?.status).toBe('waiting_user')

      const query = await queryManager.getQueryByTask(taskId)
      expect(query).toBeDefined()

      if (query) {
        // Submit response
        await queryManager.submitResponse(query.id, query.options[0].id)

        // Wait for orchestrator to resume
        await new Promise(resolve => setTimeout(resolve, 100))

        const updated = await orchestrator.taskManager.getTask(taskId)
        expect(updated?.status).toBe('running')
      }
    })

    it('task continues execution after resumption', async () => {
      const taskId = await orchestrator.submitTask('Choose between TypeScript or JavaScript')

      await new Promise(resolve => setTimeout(resolve, 100))

      const query = await queryManager.getQueryByTask(taskId)
      expect(query).toBeDefined()

      if (query) {
        // Submit response
        await queryManager.submitResponse(query.id, query.options[0].id)

        // Wait for orchestrator to continue
        await new Promise(resolve => setTimeout(resolve, 100))

        const task = await orchestrator.taskManager.getTask(taskId)
        // Task should eventually complete or continue running
        expect(['running', 'completed']).toContain(task?.status)
      }
    })
  })

  describe('task continues with user choice after resumption', () => {
    it('task receives user choice and uses it in execution', async () => {
      const taskId = await orchestrator.submitTask('Choose between React or Vue')

      await new Promise(resolve => setTimeout(resolve, 100))

      const query = await queryManager.getQueryByTask(taskId)
      expect(query).toBeDefined()

      if (query && query.options.length > 0) {
        const selectedOption = query.options[0]
        await queryManager.submitResponse(query.id, selectedOption.id)

        await new Promise(resolve => setTimeout(resolve, 100))

        // Verify the response was recorded
        const updatedQuery = await queryManager.getQuery(query.id)
        expect(updatedQuery?.selectedOption).toBe(selectedOption.id)
        expect(updatedQuery?.respondedAt).toBeDefined()

        // Task metadata or result should reflect the choice
        const task = await orchestrator.taskManager.getTask(taskId)
        expect(task).toBeDefined()

        // The task should have access to the user's choice through query metadata
        // or task metadata (implementation dependent)
        const history = await historyStore.getHistory(taskId)
        const responseEvent = history?.events.find(e => e.type === 'user_response')
        expect(responseEvent).toBeDefined()
        if (responseEvent?.type === 'user_response') {
          expect(responseEvent.response).toBe(selectedOption.id)
        }
      }
    })

    it('handles multiple sequential queries in same task', async () => {
      const taskId = await orchestrator.submitTask('First choose database, then choose framework')

      await new Promise(resolve => setTimeout(resolve, 100))

      // First query
      let query = await queryManager.getQueryByTask(taskId)
      expect(query).toBeDefined()

      if (query) {
        await queryManager.submitResponse(query.id, query.options[0].id)
        await new Promise(resolve => setTimeout(resolve, 100))

        // Second query should be created
        query = await queryManager.getQueryByTask(taskId)
        expect(query).toBeDefined()
        expect(query?.question).toBeDefined()

        // Respond to second query
        await queryManager.submitResponse(query.id, query.options[0].id)
        await new Promise(resolve => setTimeout(resolve, 100))

        const task = await orchestrator.taskManager.getTask(taskId)
        expect(['running', 'completed']).toContain(task?.status)
      }
    })
  })

  describe('orchestrator handles inquiry task type', () => {
    it('detects inquiry task and triggers user interaction flow', async () => {
      const inquiryTasks = [
        'Choose between option A or B',
        'Select the best framework',
        'Decide on database type',
      ]

      for (const description of inquiryTasks) {
        const taskId = await orchestrator.submitTask(description)
        await new Promise(resolve => setTimeout(resolve, 100))

        const task = await orchestrator.taskManager.getTask(taskId)
        expect(task?.type).toBe('inquiry')
        expect(task?.status).toBe('waiting_user')

        const query = await queryManager.getQueryByTask(taskId)
        expect(query).toBeDefined()
      }
    })
  })
})
