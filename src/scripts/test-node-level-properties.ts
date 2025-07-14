#!/usr/bin/env node

/**
 * Test script demonstrating all node-level properties in n8n workflows
 * Shows correct placement and usage of properties that must be at node level
 */

import { createDatabaseAdapter } from '../database/database-adapter.js';
import { NodeRepository } from '../database/node-repository.js';
import { WorkflowValidator } from '../services/workflow-validator.js';
import { WorkflowDiffEngine } from '../services/workflow-diff-engine.js';
import { join } from 'path';

async function main() {
  console.log('🔍 Testing Node-Level Properties Configuration\n');

  // Initialize database
  const dbPath = join(process.cwd(), 'nodes.db');
  const dbAdapter = await createDatabaseAdapter(dbPath);
  const nodeRepository = new NodeRepository(dbAdapter);
  const EnhancedConfigValidator = (await import('../services/enhanced-config-validator.js')).EnhancedConfigValidator;
  const validator = new WorkflowValidator(nodeRepository, EnhancedConfigValidator);
  const diffEngine = new WorkflowDiffEngine();

  // Example 1: Complete node with all properties
  console.log('1️⃣ Complete Node Configuration Example:');
  const completeNode = {
    id: 'node_1',
    name: 'Database Query',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.6,
    position: [450, 300] as [number, number],
    
    // Operation parameters (inside parameters)
    parameters: {
      operation: 'executeQuery',
      query: 'SELECT * FROM users WHERE active = true'
    },
    
    // Node-level properties (NOT inside parameters!)
    credentials: {
      postgres: {
        id: 'cred_123',
        name: 'Production Database'
      }
    },
    disabled: false,
    notes: 'This node queries active users from the production database',
    notesInFlow: true,
    executeOnce: true,
    
    // Error handling (also at node level!)
    onError: 'continueErrorOutput' as const,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    alwaysOutputData: true
  };
  
  console.log(JSON.stringify(completeNode, null, 2));
  console.log('\n✅ All properties are at the correct level!\n');

  // Example 2: Workflow with properly configured nodes
  console.log('2️⃣ Complete Workflow Example:');
  const workflow = {
    name: 'Production Data Processing',
    nodes: [
      {
        id: 'trigger_1',
        name: 'Every Hour',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1.2,
        position: [250, 300] as [number, number],
        parameters: {
          rule: { interval: [{ field: 'hours', hoursInterval: 1 }] }
        },
        notes: 'Runs every hour to check for new data',
        notesInFlow: true
      },
      completeNode,
      {
        id: 'error_handler',
        name: 'Error Notification',
        type: 'n8n-nodes-base.slack',
        typeVersion: 2.3,
        position: [650, 450] as [number, number],
        parameters: {
          resource: 'message',
          operation: 'post',
          channel: '#alerts',
          text: 'Database query failed!'
        },
        credentials: {
          slackApi: {
            id: 'cred_456',
            name: 'Alert Slack'
          }
        },
        executeOnce: true,
        onError: 'continueRegularOutput' as const
      }
    ],
    connections: {
      'Every Hour': {
        main: [[{ node: 'Database Query', type: 'main', index: 0 }]]
      },
      'Database Query': {
        main: [[{ node: 'Process Data', type: 'main', index: 0 }]],
        error: [[{ node: 'Error Notification', type: 'main', index: 0 }]]
      }
    }
  };

  // Validate the workflow
  console.log('\n3️⃣ Validating Workflow:');
  const result = await validator.validateWorkflow(workflow as any, { profile: 'strict' });
  console.log(`Valid: ${result.valid}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Warnings: ${result.warnings.length}`);
  
  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach((err: any) => console.log(`- ${err.message}`));
  }

  // Example 3: Using workflow diff to update node-level properties
  console.log('\n4️⃣ Updating Node-Level Properties with Diff Engine:');
  const operations = [
    {
      type: 'updateNode' as const,
      nodeName: 'Database Query',
      changes: {
        // Update operation parameters
        'parameters.query': 'SELECT * FROM users WHERE active = true AND created_at > NOW() - INTERVAL \'7 days\'',
        
        // Update node-level properties (no 'parameters.' prefix!)
        'onError': 'stopWorkflow',
        'executeOnce': false,
        'notes': 'Updated to only query users from last 7 days',
        'maxTries': 5,
        'disabled': false
      }
    }
  ];

  console.log('Operations:');
  console.log(JSON.stringify(operations, null, 2));
  
  // Example 4: Common mistakes to avoid
  console.log('\n5️⃣ ❌ COMMON MISTAKES TO AVOID:');
  
  const wrongNode = {
    id: 'wrong_1',
    name: 'Wrong Configuration',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [250, 300] as [number, number],
    parameters: {
      method: 'POST',
      url: 'https://api.example.com',
      // ❌ WRONG - These should NOT be inside parameters!
      onError: 'continueErrorOutput',
      retryOnFail: true,
      executeOnce: true,
      notes: 'This is wrong!',
      credentials: { httpAuth: { id: '123' } }
    }
  };

  console.log('❌ Wrong (properties inside parameters):');
  console.log(JSON.stringify(wrongNode.parameters, null, 2));
  
  // Validate wrong configuration
  const wrongWorkflow = {
    name: 'Wrong Example',
    nodes: [wrongNode],
    connections: {}
  };
  
  const wrongResult = await validator.validateWorkflow(wrongWorkflow as any);
  console.log('\nValidation of wrong configuration:');
  wrongResult.errors.forEach((err: any) => console.log(`❌ ERROR: ${err.message}`));

  console.log('\n✅ Summary of Node-Level Properties:');
  console.log('- credentials: Link to credential sets');
  console.log('- disabled: Disable node execution');
  console.log('- notes: Internal documentation');
  console.log('- notesInFlow: Show notes on canvas');
  console.log('- executeOnce: Execute only once per run');
  console.log('- onError: Error handling strategy');
  console.log('- retryOnFail: Enable automatic retries');
  console.log('- maxTries: Number of retry attempts');
  console.log('- waitBetweenTries: Delay between retries');
  console.log('- alwaysOutputData: Output data on error');
  console.log('- continueOnFail: (deprecated - use onError)');
  
  console.log('\n🎯 Remember: All these properties go at the NODE level, not inside parameters!');
}

main().catch(console.error);