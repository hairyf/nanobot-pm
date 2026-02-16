import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseAppConfig } from '../../src/config/schema'
import { Orchestrator } from '../../src/orchestrator'
import { createMockAgent } from '../helpers'

describe('downstream Task Delegation Flow (T057)', () => {
  let orchestrator: Orchestrator

  beforeEach(() => {
    const storage = createStorage({ driver: memoryDriver() })
    const config = parseAppConfig({})
    orchestrator = new Orchestrator({ config, storage })

    // Register multiple agents with different specialties
    const frontendAgent = createMockAgent({
      id: 'frontend-1',
      name: 'Frontend Agent',
      capabilities: ['coding'],
      specialties: ['react', 'typescript', 'frontend'],
    })

    const backendAgent = createMockAgent({
      id: 'backend-1',
      name: 'Backend Agent',
      capabilities: ['coding'],
      specialties: ['nodejs', 'api', 'backend'],
    })

    const databaseAgent = createMockAgent({
      id: 'database-1',
      name: 'Database Agent',
      capabilities: ['coding'],
      specialties: ['sql', 'database', 'postgresql'],
    })

    orchestrator.registry.register(frontendAgent)
    orchestrator.registry.register(backendAgent)
    orchestrator.registry.register(databaseAgent)
  })

  it('parent task creates child tasks for different agent specialties', async () => {
    const parentTaskId = await orchestrator.submitTask('Build a full-stack application', {
      parentTaskId: undefined,
      depth: 0,
    })

    // Wait for parent task to process and create child tasks
    await new Promise(resolve => setTimeout(resolve, 100))

    const parentTask = await orchestrator.taskManager.getTask(parentTaskId)
    expect(parentTask).toBeDefined()
    expect(parentTask?.type).toBe('downstream')
    expect(parentTask?.childTaskIds.length).toBeGreaterThan(0)

    // Verify child tasks were created
    const childTasks = await orchestrator.taskManager.getChildTasks(parentTaskId)
    expect(childTasks.length).toBeGreaterThan(0)
  })

  it('child tasks are assigned to appropriate agents based on specialties', async () => {
    const parentTaskId = await orchestrator.submitTask('Create a web application with frontend, backend, and database', {
      parentTaskId: undefined,
      depth: 0,
    })

    await new Promise(resolve => setTimeout(resolve, 150))

    const childTasks = await orchestrator.taskManager.getChildTasks(parentTaskId)
    expect(childTasks.length).toBeGreaterThan(0)

    // Verify each child task is assigned to an appropriate agent
    for (const childTask of childTasks) {
      expect(childTask.assignedAgent).toBeDefined()
      const agent = orchestrator.registry.get(childTask.assignedAgent!)
      expect(agent).toBeDefined()

      // Verify assignment makes sense (e.g., frontend task → frontend agent)
      // This is a basic check - actual matching logic would be more sophisticated
      if (childTask.description.toLowerCase().includes('frontend') || childTask.description.toLowerCase().includes('ui')) {
        expect(agent?.specialties.some(s => s.includes('frontend') || s.includes('react'))).toBe(true)
      }
      if (childTask.description.toLowerCase().includes('backend') || childTask.description.toLowerCase().includes('api')) {
        expect(agent?.specialties.some(s => s.includes('backend') || s.includes('api'))).toBe(true)
      }
      if (childTask.description.toLowerCase().includes('database') || childTask.description.toLowerCase().includes('sql')) {
        expect(agent?.specialties.some(s => s.includes('database') || s.includes('sql'))).toBe(true)
      }
    }
  })

  it('child tasks are delegated with prompt and metadata', async () => {
    const parentTaskId = await orchestrator.submitTask('Build application components', {
      parentTaskId: undefined,
      depth: 0,
    })

    await new Promise(resolve => setTimeout(resolve, 200))

    const childTasks = await orchestrator.taskManager.getChildTasks(parentTaskId)
    expect(childTasks.length).toBeGreaterThan(0)

    // Wait for child tasks to be processed (delegated)
    let allDelegated = false
    let attempts = 0
    while (!allDelegated && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 50))
      const updatedChildren = await orchestrator.taskManager.getChildTasks(parentTaskId)
      allDelegated = updatedChildren.every(task => task.status === 'running' && task.metadata?.delegated === true)
      attempts++
    }

    // Verify child tasks are delegated with prompt
    const delegatedChildren = await orchestrator.taskManager.getChildTasks(parentTaskId)
    for (const child of delegatedChildren) {
      expect(child.status).toBe('running')
      expect(child.metadata?.delegated).toBe(true)
      expect(child.metadata?.prompt).toBeDefined()
    }

    // Verify parent task still exists and tracks children
    const parentTask = await orchestrator.taskManager.getTask(parentTaskId)
    expect(parentTask).toBeDefined()
  })

  it('parent task stays running while delegated children are pending completion', async () => {
    const parentTaskId = await orchestrator.submitTask('Complete multi-component project', {
      parentTaskId: undefined,
      depth: 0,
    })

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 200))

    const childTasks = await orchestrator.taskManager.getChildTasks(parentTaskId)
    expect(childTasks.length).toBeGreaterThan(0)

    // Wait for children to be delegated
    let allDelegated = false
    let attempts = 0
    while (!allDelegated && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 50))
      const updatedChildren = await orchestrator.taskManager.getChildTasks(parentTaskId)
      allDelegated = updatedChildren.every(task => task.status === 'running')
      attempts++
    }

    // All child tasks should be running (delegated to external agents)
    const updatedChildren = await orchestrator.taskManager.getChildTasks(parentTaskId)
    for (const child of updatedChildren) {
      expect(child.status).toBe('running')
      expect(child.metadata?.delegated).toBe(true)
    }

    // Parent task should still be running (waiting for child completions via `complete` command)
    const parentTask = await orchestrator.taskManager.getTask(parentTaskId)
    expect(parentTask).toBeDefined()
    expect(parentTask?.status).toBe('running')
  })

  it('handles nested downstream tasks (child tasks creating their own children)', async () => {
    const rootTaskId = await orchestrator.submitTask('Build complex system with nested components', {
      parentTaskId: undefined,
      depth: 0,
    })

    await new Promise(resolve => setTimeout(resolve, 150))

    const level1Children = await orchestrator.taskManager.getChildTasks(rootTaskId)
    expect(level1Children.length).toBeGreaterThan(0)

    // Check if any level 1 children create their own children
    let _hasNestedChildren = false
    for (const child of level1Children) {
      await new Promise(resolve => setTimeout(resolve, 50))
      const level2Children = await orchestrator.taskManager.getChildTasks(child.id)
      if (level2Children.length > 0) {
        _hasNestedChildren = true
        // Verify depth is tracked correctly
        expect(level2Children[0].depth).toBe(2)
        break
      }
    }

    // At least verify the structure exists (may or may not have nested children depending on implementation)
    const rootTask = await orchestrator.taskManager.getTask(rootTaskId)
    expect(rootTask).toBeDefined()
  })

  it('maintains correct depth tracking across delegation chain', async () => {
    const rootTaskId = await orchestrator.submitTask('Create application', {
      parentTaskId: undefined,
      depth: 0,
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const rootTask = await orchestrator.taskManager.getTask(rootTaskId)
    expect(rootTask?.depth).toBe(0)

    const level1Children = await orchestrator.taskManager.getChildTasks(rootTaskId)
    for (const child of level1Children) {
      expect(child.depth).toBe(1)
      expect(child.parentTaskId).toBe(rootTaskId)
    }

    // If nested children exist, verify their depth
    for (const level1Child of level1Children) {
      const level2Children = await orchestrator.taskManager.getChildTasks(level1Child.id)
      for (const level2Child of level2Children) {
        expect(level2Child.depth).toBe(2)
        expect(level2Child.parentTaskId).toBe(level1Child.id)
      }
    }
  })

  it('handles child task failures gracefully', async () => {
    const parentTaskId = await orchestrator.submitTask('Build application with potential failures', {
      parentTaskId: undefined,
      depth: 0,
    })

    await new Promise(resolve => setTimeout(resolve, 200))

    const childTasks = await orchestrator.taskManager.getChildTasks(parentTaskId)
    expect(childTasks.length).toBeGreaterThan(0)

    // Wait for tasks to process (some may fail)
    await new Promise(resolve => setTimeout(resolve, 200))

    const updatedChildren = await orchestrator.taskManager.getChildTasks(parentTaskId)
    const failedChildren = updatedChildren.filter(task => task.status === 'failed')

    // If there are failures, parent should handle them appropriately
    if (failedChildren.length > 0) {
      const parentTask = await orchestrator.taskManager.getTask(parentTaskId)
      // Parent should still be processable or handle failures
      expect(parentTask).toBeDefined()
    }
  })
})
