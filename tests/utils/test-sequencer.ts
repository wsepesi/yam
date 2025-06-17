// Test Sequencer for Vitest
// Forces specific test suites to run sequentially to prevent database conflicts

import type { TestSequencer, WorkspaceSpec } from 'vitest/node'

export class DatabaseTestSequencer implements TestSequencer {
  // Test suites that should run sequentially due to database operations
  private sequentialSuites = [
    'database-scale.test.ts',
    'package-failure-workflow.test.ts',
    'email-integration.test.ts',
    'multi-tenant-security.test.ts',
    'package-queue-stress.test.ts',
    'concurrent-package-ops.test.ts',
    'concurrent-users.test.ts',
    'database-performance.test.ts'
  ]

  async shard(files: WorkspaceSpec[]): Promise<WorkspaceSpec[]> {
    return files
  }

  async sort(files: WorkspaceSpec[]): Promise<WorkspaceSpec[]> {
    // Separate sequential and parallel tests
    const sequential: WorkspaceSpec[] = []
    const parallel: WorkspaceSpec[] = []

    for (const file of files) {
      const isSequential = this.sequentialSuites.some(suite => 
        file.moduleId.includes(suite)
      )
      
      if (isSequential) {
        sequential.push(file)
      } else {
        parallel.push(file)
      }
    }

    // Run sequential tests first, then parallel
    return [...sequential, ...parallel]
  }
}