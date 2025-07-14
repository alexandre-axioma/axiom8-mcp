interface ToolDocumentation {
  name: string;
  category: string;
  essentials: {
    description: string;
    keyParameters: string[];
    example: string;
    performance: string;
    tips: string[];
  };
  full: {
    description: string;
    parameters: Record<string, { type: string; description: string; required?: boolean }>;
    returns: string;
    examples: string[];
    useCases: string[];
    performance: string;
    bestPractices: string[];
    pitfalls: string[];
    relatedTools: string[];
  };
}

export const toolsDocumentation: Record<string, ToolDocumentation> = {
  search_nodes: {
    name: 'search_nodes',
    category: 'discovery',
    essentials: {
      description: 'Search nodes. Primary nodes ranked first.',
      keyParameters: ['query', 'limit', 'mode'],
      example: 'search_nodes({query: "webhook"})',
      performance: 'Fast - FTS5 when available',
      tips: [
        'Primary nodes first: webhook→Webhook, http→HTTP Request',
        'Modes: OR (any word), AND (all words), FUZZY (typos OK)'
      ]
    },
    full: {
      description: 'Search n8n nodes using FTS5 full-text search (when available) with relevance ranking. Supports OR (default), AND, and FUZZY search modes. Results are sorted by relevance, ensuring primary nodes like Webhook and HTTP Request appear first.',
      parameters: {
        query: { type: 'string', description: 'Search terms. Wrap in quotes for exact phrase matching', required: true },
        limit: { type: 'number', description: 'Maximum results to return (default: 20)', required: false },
        mode: { type: 'string', description: 'Search mode: OR (any word), AND (all words in ANY field), FUZZY (typo-tolerant using edit distance)', required: false }
      },
      returns: 'Array of nodes sorted by relevance with nodeType, displayName, description, category. AND mode includes searchInfo explaining the search scope.',
      examples: [
        'search_nodes({query: "webhook"}) - Webhook node appears first',
        'search_nodes({query: "http call"}) - HTTP Request node appears first',
        'search_nodes({query: "send message", mode: "AND"}) - Nodes with both words anywhere in their data',
        'search_nodes({query: "slak", mode: "FUZZY"}) - Finds Slack using typo tolerance'
      ],
      useCases: [
        'Finding primary nodes quickly (webhook, http, email)',
        'Discovering nodes with typo tolerance',
        'Precise searches with AND mode',
        'Exploratory searches with OR mode'
      ],
      performance: 'FTS5: <20ms for most queries. Falls back to optimized LIKE queries if FTS5 unavailable.',
      bestPractices: [
        'Default OR mode is best for exploration',
        'Use AND mode when you need all terms present',
        'Use FUZZY mode if unsure of spelling',
        'Quotes force exact phrase matching',
        'Primary nodes are boosted in relevance'
      ],
      pitfalls: [
        'AND mode searches ALL fields (description, documentation, operations) not just names',
        'FUZZY mode uses edit distance - may return unexpected matches for very short queries',
        'Special characters are ignored in search',
        'FTS5 syntax errors fallback to basic LIKE search'
      ],
      relatedTools: ['list_nodes', 'get_node_essentials', 'get_node_info']
    }
  },

  get_node_essentials: {
    name: 'get_node_essentials',
    category: 'configuration',
    essentials: {
      description: 'Get 10-20 key properties with examples',
      keyParameters: ['nodeType'],
      example: 'get_node_essentials("nodes-base.slack")',
      performance: '<5KB vs 100KB+',
      tips: [
        'Use this first! Has examples.'
      ]
    },
    full: {
      description: 'Returns a curated set of essential properties for a node, typically 10-20 most commonly used properties. Includes working examples and is 95% smaller than get_node_info. Designed for efficient node configuration.',
      parameters: {
        nodeType: { type: 'string', description: 'Full node type (e.g., "n8n-nodes-base.slack")', required: true }
      },
      returns: 'Object with node info, essential properties, examples, and common patterns',
      examples: [
        'get_node_essentials("n8n-nodes-base.httpRequest") - Get HTTP request essentials',
        'get_node_essentials("n8n-nodes-base.webhook") - Get webhook configuration',
        'get_node_essentials("n8n-nodes-base.slack") - Get Slack essentials'
      ],
      useCases: [
        'Quickly configuring nodes without information overload',
        'Getting working examples for immediate use',
        'Understanding the most important node options',
        'Building workflows efficiently'
      ],
      performance: 'Extremely fast - returns pre-filtered data. Response size <5KB vs 100KB+ for full node info.',
      bestPractices: [
        'Always try this before get_node_info',
        'Use included examples as starting points',
        'Check commonPatterns for typical configurations',
        'Combine with validate_node_minimal for quick validation'
      ],
      pitfalls: [
        'May not include rarely-used properties',
        'Some advanced options might be missing',
        'Use search_node_properties if specific property not found'
      ],
      relatedTools: ['get_node_info', 'search_node_properties', 'validate_node_minimal']
    }
  },

  list_nodes: {
    name: 'list_nodes',
    category: 'discovery',
    essentials: {
      description: 'List all available n8n nodes with optional filtering',
      keyParameters: ['category', 'limit', 'onlyTriggers'],
      example: 'list_nodes({category: "communication", limit: 20})',
      performance: 'Fast - direct database query',
      tips: [
        'Great for browsing nodes by category',
        'Use onlyTriggers:true to find workflow starters'
      ]
    },
    full: {
      description: 'Lists all available n8n nodes with comprehensive filtering options. Can filter by category, package, trigger status, and more. Returns complete node metadata.',
      parameters: {
        category: { type: 'string', description: 'Filter by category (e.g., "communication", "data")', required: false },
        limit: { type: 'number', description: 'Maximum results (default: 50)', required: false },
        offset: { type: 'number', description: 'Pagination offset', required: false },
        onlyTriggers: { type: 'boolean', description: 'Only show trigger nodes', required: false },
        onlyAITools: { type: 'boolean', description: 'Only show AI-capable nodes', required: false },
        package: { type: 'string', description: 'Filter by package name', required: false }
      },
      returns: 'Array of nodes with complete metadata including type, name, description, category',
      examples: [
        'list_nodes() - Get first 50 nodes',
        'list_nodes({category: "trigger"}) - All trigger nodes',
        'list_nodes({onlyAITools: true}) - Nodes marked as AI tools',
        'list_nodes({package: "n8n-nodes-base", limit: 100}) - Core nodes'
      ],
      useCases: [
        'Browsing available nodes by category',
        'Finding all triggers or webhooks',
        'Discovering AI-capable nodes',
        'Getting overview of available integrations'
      ],
      performance: 'Fast - uses indexed queries. Returns in <100ms even for large result sets.',
      bestPractices: [
        'Use categories for focused browsing',
        'Combine with search_nodes for keyword search',
        'Use pagination for large result sets',
        'Check onlyTriggers for workflow starting points'
      ],
      pitfalls: [
        'No text search - use search_nodes for that',
        'Categories are predefined, not all nodes have them',
        'Large result sets without limit can be overwhelming'
      ],
      relatedTools: ['search_nodes', 'list_ai_tools', 'get_node_essentials']
    }
  },

  validate_node_minimal: {
    name: 'validate_node_minimal',
    category: 'validation',
    essentials: {
      description: 'Quick validation checking only required fields',
      keyParameters: ['nodeType', 'config'],
      example: 'validate_node_minimal("n8n-nodes-base.slack", {resource: "message", operation: "post"})',
      performance: 'Very fast - minimal checks only',
      tips: [
        'Use for quick validation during configuration',
        'Follow up with validate_node_operation for full validation'
      ]
    },
    full: {
      description: 'Performs minimal validation checking only required fields. Fastest validation option, perfect for iterative configuration. Checks if all required fields are present without complex dependency validation.',
      parameters: {
        nodeType: { type: 'string', description: 'Full node type', required: true },
        config: { type: 'object', description: 'Node configuration to validate', required: true }
      },
      returns: 'Object with isValid boolean, missing required fields, and basic feedback',
      examples: [
        'validate_node_minimal("n8n-nodes-base.httpRequest", {url: "https://api.example.com"})',
        'validate_node_minimal("n8n-nodes-base.slack", {resource: "message", operation: "post", channel: "general"})'
      ],
      useCases: [
        'Quick validation during iterative configuration',
        'Checking if minimum requirements are met',
        'Fast feedback loop while building',
        'Pre-validation before full check'
      ],
      performance: 'Extremely fast - only checks required fields. Typically <10ms.',
      bestPractices: [
        'Use during configuration for quick feedback',
        'Follow with validate_node_operation for complete validation',
        'Great for iterative development',
        'Combine with get_node_essentials for requirements'
      ],
      pitfalls: [
        'Doesn\'t check field dependencies',
        'Won\'t catch configuration conflicts',
        'Missing optional but recommended fields'
      ],
      relatedTools: ['validate_node_operation', 'get_node_essentials', 'validate_workflow']
    }
  },

  validate_node_operation: {
    name: 'validate_node_operation',
    category: 'validation',
    essentials: {
      description: 'Full validation with operation-aware checking and helpful suggestions',
      keyParameters: ['nodeType', 'config', 'profile'],
      example: 'validate_node_operation("n8n-nodes-base.slack", {resource: "message", operation: "post", channel: "general"})',
      performance: 'Moderate - comprehensive validation',
      tips: [
        'Provides specific error messages and fixes',
        'Use "strict" profile for production workflows'
      ]
    },
    full: {
      description: 'Comprehensive validation that understands operation-specific requirements. Checks dependencies, validates field values, and provides helpful suggestions for fixing issues.',
      parameters: {
        nodeType: { type: 'string', description: 'Full node type', required: true },
        config: { type: 'object', description: 'Complete node configuration', required: true },
        profile: { type: 'string', description: 'Validation profile: "development" or "strict"', required: false }
      },
      returns: 'Detailed validation results with errors, warnings, suggestions, and fixes',
      examples: [
        'validate_node_operation("n8n-nodes-base.httpRequest", {method: "POST", url: "{{$json.url}}", bodyParametersUi: {...}})',
        'validate_node_operation("n8n-nodes-base.postgres", {operation: "executeQuery", query: "SELECT * FROM users"}, "strict")'
      ],
      useCases: [
        'Final validation before deployment',
        'Understanding complex field dependencies',
        'Getting suggestions for configuration improvements',
        'Validating operation-specific requirements'
      ],
      performance: 'Moderate speed - performs comprehensive checks. 50-200ms depending on complexity.',
      bestPractices: [
        'Use after validate_node_minimal passes',
        'Apply suggested fixes from response',
        'Use strict profile for production',
        'Check warnings even if validation passes'
      ],
      pitfalls: [
        'Slower than minimal validation',
        'May be overkill for simple configurations',
        'Strict profile might be too restrictive for development'
      ],
      relatedTools: ['validate_node_minimal', 'validate_workflow', 'get_property_dependencies']
    }
  },

  get_node_for_task: {
    name: 'get_node_for_task',
    category: 'templates',
    essentials: {
      description: 'Get pre-configured node settings for common tasks',
      keyParameters: ['task'],
      example: 'get_node_for_task("send_slack_message")',
      performance: 'Instant - returns pre-built configurations',
      tips: [
        'Use list_tasks() to see all available tasks',
        'Look for userMustProvide fields to complete'
      ]
    },
    full: {
      description: 'Returns pre-configured node settings for common automation tasks. Each template includes the correct node type, operation settings, and clear markers for what needs user input.',
      parameters: {
        task: { type: 'string', description: 'Task identifier (use list_tasks to see all)', required: true }
      },
      returns: 'Complete node configuration with parameters, position, and user guidance',
      examples: [
        'get_node_for_task("send_slack_message") - Slack message template',
        'get_node_for_task("receive_webhook") - Webhook trigger setup',
        'get_node_for_task("query_database") - Database query template'
      ],
      useCases: [
        'Quickly setting up common automation patterns',
        'Learning correct node configurations',
        'Avoiding configuration mistakes',
        'Rapid workflow prototyping'
      ],
      performance: 'Instant - returns static templates. No computation required.',
      bestPractices: [
        'Check userMustProvide fields for required inputs',
        'Use list_tasks() to discover available templates',
        'Validate with validate_node_minimal after filling in',
        'Use as starting point, then customize'
      ],
      pitfalls: [
        'Templates are generic - customize for specific needs',
        'Not all tasks have templates',
        'Some fields marked userMustProvide are critical'
      ],
      relatedTools: ['list_tasks', 'get_node_essentials', 'validate_node_minimal']
    }
  },

  n8n_create_workflow: {
    name: 'n8n_create_workflow',
    category: 'workflow_management',
    essentials: {
      description: 'Create a new workflow in n8n via API',
      keyParameters: ['name', 'nodes', 'connections'],
      example: 'n8n_create_workflow({name: "My Workflow", nodes: [...], connections: {...}})',
      performance: 'API call - depends on n8n instance',
      tips: [
        'ALWAYS use node names in connections, never IDs',
        'Error handling properties go at NODE level, not inside parameters!',
        'Requires N8N_API_URL and N8N_API_KEY configuration'
      ]
    },
    full: {
      description: 'Creates a new workflow in your n8n instance via API. Requires proper API configuration. Returns the created workflow with assigned ID.\n\n⚠️ CRITICAL: Error handling properties (onError, retryOnFail, etc.) are NODE-LEVEL properties, not inside parameters!',
      parameters: {
        name: { type: 'string', description: 'Workflow name', required: true },
        nodes: { type: 'array', description: 'Array of node configurations', required: true },
        connections: { type: 'object', description: 'Node connections (use names!)', required: true },
        settings: { type: 'object', description: 'Workflow settings', required: false },
        tags: { type: 'array', description: 'Tag IDs (not names)', required: false }
      },
      returns: 'Created workflow object with id, name, nodes, connections, and metadata',
      examples: [
        `// Basic workflow with proper error handling
n8n_create_workflow({
  name: "Slack Notification with Error Handling",
  nodes: [
    {
      id: "1",
      name: "Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [250, 300],
      parameters: {
        path: "/webhook",
        method: "POST"
      },
      // ✅ CORRECT - Error handling at node level
      onError: "continueRegularOutput"
    },
    {
      id: "2",
      name: "Database Query",
      type: "n8n-nodes-base.postgres",
      typeVersion: 2.4,
      position: [450, 300],
      parameters: {
        operation: "executeQuery",
        query: "SELECT * FROM users"
      },
      // ✅ CORRECT - Error handling at node level
      onError: "continueErrorOutput",
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 2000
    },
    {
      id: "3",
      name: "Error Handler",
      type: "n8n-nodes-base.slack",
      typeVersion: 2.2,
      position: [650, 450],
      parameters: {
        resource: "message",
        operation: "post",
        channel: "#errors",
        text: "Database query failed!"
      }
    }
  ],
  connections: {
    "Webhook": {
      main: [[{node: "Database Query", type: "main", index: 0}]]
    },
    "Database Query": {
      main: [[{node: "Success Handler", type: "main", index: 0}]],
      error: [[{node: "Error Handler", type: "main", index: 0}]]  // Error output
    }
  }
})`
      ],
      useCases: [
        'Deploying workflows programmatically',
        'Automating workflow creation',
        'Migrating workflows between instances',
        'Creating workflows from templates',
        'Building error-resilient workflows'
      ],
      performance: 'Depends on n8n instance and network. Typically 100-500ms.',
      bestPractices: [
        'CRITICAL: Use node NAMES in connections, not IDs',
        'CRITICAL: Place error handling at NODE level, not in parameters',
        'Validate workflow before creating',
        'Use meaningful workflow names',
        'Add error handling to external service nodes',
        'Check n8n_health_check before creating'
      ],
      pitfalls: [
        'Placing error handling properties inside parameters object',
        'Using node IDs in connections breaks UI display',
        'Workflow not automatically activated',
        'Tags must exist (use tag IDs not names)',
        'API must be configured correctly'
      ],
      relatedTools: ['validate_workflow', 'n8n_update_partial_workflow', 'n8n_list_workflows']
    }
  },

  n8n_update_partial_workflow: {
    name: 'n8n_update_partial_workflow',
    category: 'workflow_management',
    essentials: {
      description: 'Update workflows using diff operations - only send changes, not entire workflow',
      keyParameters: ['id', 'operations'],
      example: 'n8n_update_partial_workflow({id: "123", operations: [{type: "updateNode", nodeName: "Slack", changes: {onError: "continueRegularOutput"}}]})',
      performance: '80-90% more efficient than full updates',
      tips: [
        'Maximum 5 operations per request',
        'Can reference nodes by name or ID',
        'Error handling properties go at NODE level, not inside parameters!'
      ]
    },
    full: {
      description: 'Update existing workflows using diff operations. Much more efficient than full updates as it only sends the changes. Supports 13 different operation types.\n\n⚠️ CRITICAL: Error handling properties (onError, retryOnFail, maxTries, etc.) are NODE-LEVEL properties, not parameters!',
      parameters: {
        id: { type: 'string', description: 'Workflow ID to update', required: true },
        operations: { type: 'array', description: 'Array of diff operations (max 5)', required: true },
        validateOnly: { type: 'boolean', description: 'Only validate without applying', required: false }
      },
      returns: 'Updated workflow with applied changes and operation results',
      examples: [
        `// Update node parameters (properties inside parameters object)
n8n_update_partial_workflow({
  id: "123",
  operations: [{
    type: "updateNode",
    nodeName: "Slack",
    changes: {
      "parameters.channel": "#general",  // Nested property
      "parameters.text": "Hello world"    // Nested property
    }
  }]
})`,
        `// Update error handling (NODE-LEVEL properties, NOT inside parameters!)
n8n_update_partial_workflow({
  id: "123",
  operations: [{
    type: "updateNode",
    nodeName: "HTTP Request",
    changes: {
      onError: "continueErrorOutput",    // ✅ Correct - node level
      retryOnFail: true,                 // ✅ Correct - node level
      maxTries: 3,                       // ✅ Correct - node level
      waitBetweenTries: 2000             // ✅ Correct - node level
    }
  }]
})`,
        `// WRONG - Don't put error handling inside parameters!
// ❌ BAD: changes: {"parameters.onError": "continueErrorOutput"}
// ✅ GOOD: changes: {onError: "continueErrorOutput"}`,
        `// Add error connection between nodes
n8n_update_partial_workflow({
  id: "123",
  operations: [{
    type: "addConnection",
    source: "Database Query",
    target: "Error Handler",
    sourceOutput: "error",  // Error output
    targetInput: "main"
  }]
})`
      ],
      useCases: [
        'Updating node configurations',
        'Adding error handling to nodes',
        'Adding/removing connections',
        'Enabling/disabling nodes',
        'Moving nodes in canvas',
        'Updating workflow metadata'
      ],
      performance: 'Very efficient - only sends changes. 80-90% less data than full updates.',
      bestPractices: [
        'Error handling properties (onError, retryOnFail, etc.) go at NODE level, not in parameters',
        'Use dot notation for nested properties: "parameters.url"',
        'Batch related operations together',
        'Use validateOnly:true to test first',
        'Reference nodes by name for clarity'
      ],
      pitfalls: [
        'Placing error handling properties inside parameters (common mistake!)',
        'Maximum 5 operations per request',
        'Some operations have dependencies',
        'Node must exist for update operations',
        'Connection nodes must both exist'
      ],
      relatedTools: ['n8n_get_workflow', 'n8n_update_full_workflow', 'validate_workflow']
    }
  },

  // Code Node specific documentation
  code_node_guide: {
    name: 'code_node_guide',
    category: 'code_node',
    essentials: {
      description: 'Comprehensive guide for writing Code node JavaScript and Python',
      keyParameters: ['topic'],
      example: 'tools_documentation({topic: "code_node_guide"})',
      performance: 'Instant - returns documentation',
      tips: [
        'Essential reading before writing Code node scripts',
        'Covers all built-in variables and helpers',
        'Includes common patterns and error handling'
      ]
    },
    full: {
      description: `Complete reference for the n8n Code node, covering JavaScript and Python execution environments, built-in variables, helper functions, and best practices.

## Code Node Basics

The Code node allows custom JavaScript or Python code execution within workflows. It runs in a sandboxed environment with access to n8n-specific variables and helpers.

### JavaScript Environment
- **ES2022 support** with async/await
- **Built-in libraries**: 
  - **luxon** (DateTime) - Date/time manipulation
  - **jmespath** - JSON queries via $jmespath()
  - **crypto** - Available via require('crypto') despite editor warnings!
- **Node.js globals**: Buffer, process.env (limited)
- **require() IS available** for built-in modules only (crypto, util, etc.)
- **No npm packages** - only Node.js built-ins and n8n-provided libraries

### Python Environment  
- **Python 3.10+** with standard library (Pyodide runtime)
- **No pip install** - standard library only
- **Variables use underscore prefix**: \`_input\`, \`_json\`, \`_jmespath\` (not \`$\`)
- **item.json is JsProxy**: Use \`.to_py()\` to convert to Python dict
- **Shared state** between Code nodes in same execution

## Essential Variables

### $input
Access to all incoming data:
\`\`\`javascript
// Get all items from all inputs
const allItems = $input.all();  // Returns: Item[][]

// Get items from specific input (0-indexed)
const firstInput = $input.all(0);  // Returns: Item[]

// Get first item from first input
const firstItem = $input.first();  // Returns: Item

// Get last item from first input  
const lastItem = $input.last();  // Returns: Item

// Get specific item by index
const item = $input.item(2);  // Returns: Item at index 2
\`\`\`

### items
Direct access to incoming items (legacy, prefer $input):
\`\`\`javascript
// items is equivalent to $input.all()[0]
for (const item of items) {
  console.log(item.json);  // Access JSON data
  console.log(item.binary);  // Access binary data
}
\`\`\`

### $json
Shortcut to current item's JSON data (only in "Run Once for Each Item" mode):
\`\`\`javascript
// These are equivalent in single-item mode:
const value1 = $json.fieldName;
const value2 = items[0].json.fieldName;
\`\`\`

### Accessing Other Nodes
Access data from other nodes using $('Node Name') syntax:
\`\`\`javascript
// Access another node's output - use $('Node Name') NOT $node
const prevData = $('Previous Node').all();
const firstItem = $('Previous Node').first();
const specificItem = $('Previous Node').item(0);

// Get node parameter
const webhookUrl = $('Webhook').params.path;

// Python uses underscore prefix
const pythonData = _('Previous Node').all();
\`\`\`

⚠️ **Expression vs Code Node Syntax**:
- **Expressions**: \`{{$node['Previous Node'].json.field}}\`
- **Code Node**: \`$('Previous Node').first().json.field\`
- These are NOT interchangeable!

### $workflow
Workflow metadata:
\`\`\`javascript
const workflowId = $workflow.id;
const workflowName = $workflow.name;
const isActive = $workflow.active;
\`\`\`

### $execution
Execution context:
\`\`\`javascript
const executionId = $execution.id;
const executionMode = $execution.mode;  // 'manual', 'trigger', etc.
const resumeUrl = $execution.resumeUrl;  // For wait nodes
\`\`\`

### $prevNode
Access to the immediate previous node:
\`\`\`javascript
const prevOutput = $prevNode.outputIndex;  // Which output triggered this
const prevData = $prevNode.data;  // Previous node's data
const prevName = $prevNode.name;  // Previous node's name
\`\`\`

## Helper Functions

### Date/Time (Luxon)
\`\`\`javascript
// Current time
const now = DateTime.now();
const iso = now.toISO();

// Parse dates
const date = DateTime.fromISO('2024-01-01');
const formatted = date.toFormat('yyyy-MM-dd');

// Time math
const tomorrow = now.plus({ days: 1 });
const hourAgo = now.minus({ hours: 1 });
\`\`\`

### JSON Queries (JMESPath)
\`\`\`javascript
// n8n uses $jmespath() - NOTE: parameter order is reversed from standard JMESPath!
const data = { users: [{ name: 'John', age: 30 }, { name: 'Jane', age: 25 }] };
const names = $jmespath(data, 'users[*].name');  // ['John', 'Jane']

// ⚠️ IMPORTANT: Numeric literals in filters need BACKTICKS in n8n!
const adults = $jmespath(data, 'users[?age >= \`18\`]');  // ✅ CORRECT - backticks around 18
const seniors = $jmespath(data, 'users[?age >= \`65\`]');  // ✅ CORRECT

// ❌ WRONG - This will cause a syntax error!
// const adults = $jmespath(data, 'users[?age >= 18]');  // Missing backticks

// More filter examples with proper backticks:
const expensive = $jmespath(items, '[?price > \`100\`]');
const inStock = $jmespath(products, '[?quantity >= \`1\`]');
const highPriority = $jmespath(tasks, '[?priority == \`1\`]');

// String comparisons don't need backticks
const activeUsers = $jmespath(data, 'users[?status == "active"]');

// Python uses underscore prefix
const pythonAdults = _jmespath(data, 'users[?age >= \`18\`]');
\`\`\`

⚠️ **CRITICAL DIFFERENCES** from standard JMESPath:
1. **Parameter order is REVERSED**:
   - **Expression**: \`{{$jmespath("query", data)}}\`
   - **Code Node**: \`$jmespath(data, "query")\`
2. **Numeric literals in filters MUST use backticks**: \`[?age >= \`18\`]\`
   - This is n8n-specific and differs from standard JMESPath documentation!

### Available Functions and Libraries

#### Built-in Node.js Modules (via require)
\`\`\`javascript
// ✅ These modules ARE available via require():
const crypto = require('crypto');        // Cryptographic functions
const util = require('util');            // Utility functions
const querystring = require('querystring'); // URL query string utilities

// Example: Generate secure random token
const crypto = require('crypto');
const token = crypto.randomBytes(32).toString('hex');
const uuid = crypto.randomUUID();
\`\`\`

**Note**: The editor may show errors for require() but it WORKS at runtime!

#### Standalone Functions (Global Scope)
\`\`\`javascript
// ✅ Workflow static data - persists between executions
// IMPORTANT: These are standalone functions, NOT methods on $helpers!
const staticData = $getWorkflowStaticData('global'); // Global static data
const nodeData = $getWorkflowStaticData('node');    // Node-specific data

// Example: Counter that persists
const staticData = $getWorkflowStaticData('global');
staticData.counter = (staticData.counter || 0) + 1;

// ❌ WRONG - This will cause "$helpers is not defined" error:
// const data = $helpers.getWorkflowStaticData('global');

// JMESPath queries - note the parameter order!
const result = $jmespath(data, 'users[*].name');
\`\`\`

#### $helpers Object (When Available)
\`\`\`javascript
// Some n8n versions provide $helpers with these methods:
// (Always test availability in your n8n instance)

// HTTP requests
const response = await $helpers.httpRequest({
  method: 'GET',
  url: 'https://api.example.com/data',
  headers: { 'Authorization': 'Bearer token' }
});

// Binary data preparation  
const binaryData = await $helpers.prepareBinaryData(
  Buffer.from('content'), 
  'file.txt',
  'text/plain'
);

// Check if $helpers exists before using:
if (typeof $helpers !== 'undefined' && $helpers.httpRequest) {
  // Use $helpers.httpRequest
} else {
  throw new Error('HTTP requests not available in this n8n version');
}
\`\`\`

#### Important Notes:
- **$getWorkflowStaticData()** is ALWAYS a standalone function
- **require()** works for built-in Node.js modules despite editor warnings
- **$helpers** availability varies by n8n version - always check first
- Python uses underscore prefix: \`_getWorkflowStaticData()\`, \`_jmespath()\`
- Editor red underlines are often false positives - test at runtime!

## Return Format

Code nodes MUST return an array of objects with 'json' property:

\`\`\`javascript
// ✅ CORRECT - Array of objects with json property
return [
  { json: { id: 1, name: 'Item 1' } },
  { json: { id: 2, name: 'Item 2' } }
];

// ✅ CORRECT - Single item (still wrapped in array)
return [{ json: { result: 'success' } }];

// ✅ CORRECT - With binary data
return [{
  json: { filename: 'report.pdf' },
  binary: {
    data: {
      data: base64String,
      mimeType: 'application/pdf',
      fileName: 'report.pdf'
    }
  }
}];

// ❌ WRONG - Not an array
return { json: { result: 'success' } };

// ❌ WRONG - No json property
return [{ result: 'success' }];

// ❌ WRONG - Not wrapped in object
return ['item1', 'item2'];
\`\`\`

## Common Patterns

### Data Transformation
\`\`\`javascript
// Transform all items
const transformedItems = [];
for (const item of items) {
  transformedItems.push({
    json: {
      ...item.json,
      processed: true,
      timestamp: DateTime.now().toISO(),
      uppercaseName: item.json.name?.toUpperCase()
    }
  });
}
return transformedItems;
\`\`\`

### Filtering Items
\`\`\`javascript
// Filter items based on condition
return items
  .filter(item => item.json.status === 'active')
  .map(item => ({ json: item.json }));
\`\`\`

### Aggregation
\`\`\`javascript
// Aggregate data from all items
const total = items.reduce((sum, item) => sum + (item.json.amount || 0), 0);
const average = total / items.length;

return [{
  json: {
    total,
    average,
    count: items.length,
    items: items.map(i => i.json)
  }
}];
\`\`\`

### Error Handling
\`\`\`javascript
// Safe data access with defaults
const results = [];
for (const item of items) {
  try {
    const value = item.json?.nested?.field || 'default';
    results.push({
      json: {
        processed: value,
        status: 'success'
      }
    });
  } catch (error) {
    results.push({
      json: {
        error: error.message,
        status: 'failed',
        originalItem: item.json
      }
    });
  }
}
return results;
\`\`\`

### Working with APIs
\`\`\`javascript
// Make HTTP request and process response
try {
  const response = await $helpers.httpRequest({
    method: 'POST',
    url: 'https://api.example.com/process',
    body: {
      data: items.map(item => item.json)
    },
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return [{ json: response }];
} catch (error) {
  throw new Error(\`API request failed: \${error.message}\`);
}
\`\`\`

### Async Operations
\`\`\`javascript
// Process items with async operations
const results = [];
for (const item of items) {
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 100));
  
  results.push({
    json: {
      ...item.json,
      processedAt: new Date().toISOString()
    }
  });
}
return results;
\`\`\`

### Webhook Data Access (CRITICAL!)
\`\`\`javascript
// ⚠️ WEBHOOK DATA IS NESTED UNDER 'body' PROPERTY!
// This is a common source of errors in webhook-triggered workflows

// ❌ WRONG - This will be undefined for webhook data:
const command = items[0].json.testCommand;

// ✅ CORRECT - Webhook data is wrapped in 'body':
const command = items[0].json.body.testCommand;

// Complete webhook data processing example:
const webhookData = items[0].json.body; // Get the actual webhook payload
const headers = items[0].json.headers;   // HTTP headers are separate
const query = items[0].json.query;       // Query parameters are separate

// Process webhook payload
return [{
  json: {
    command: webhookData.testCommand,
    user: webhookData.user,
    timestamp: DateTime.now().toISO(),
    requestId: headers['x-request-id'],
    source: query.source || 'unknown'
  }
}];

// For other trigger nodes (non-webhook), data is directly under json:
// - Schedule Trigger: items[0].json contains timestamp
// - Database Trigger: items[0].json contains row data
// - File Trigger: items[0].json contains file info
\`\`\`

## Python Code Examples

### Basic Python Structure
\`\`\`python
import json
from datetime import datetime

# Access items - Python uses underscore prefix for built-in variables
results = []
for item in _input.all():
    # IMPORTANT: item.json is NOT a standard Python dict!
    # Use to_py() to convert to a proper Python dict
    processed_item = item.json.to_py()  # Converts JsProxy to Python dict
    processed_item['timestamp'] = datetime.now().isoformat()
    results.append({'json': processed_item})

return results
\`\`\`

### Python Data Processing
\`\`\`python
# Aggregate data - use _input.all() to get items
items = _input.all()
total = sum(item.json.get('amount', 0) for item in items)
average = total / len(items) if items else 0

# For safe dict operations, convert JsProxy to Python dict
safe_items = []
for item in items:
    # Convert JsProxy to dict to avoid KeyError with null values
    safe_dict = item.json.to_py()
    safe_items.append(safe_dict)

# Return aggregated result
return [{
    'json': {
        'total': total,
        'average': average,
        'count': len(items),
        'processed_at': datetime.now().isoformat(),
        'items': safe_items  # Now these are proper Python dicts
    }
}]
\`\`\`

## Code Node as AI Tool

Code nodes can be used as custom tools for AI agents:

\`\`\`javascript
// Code node configured as AI tool
// Name: "Calculate Discount"
// Description: "Calculates discount based on quantity"

const quantity = $json.quantity || 1;
const basePrice = $json.price || 0;

let discount = 0;
if (quantity >= 100) discount = 0.20;
else if (quantity >= 50) discount = 0.15;
else if (quantity >= 20) discount = 0.10;
else if (quantity >= 10) discount = 0.05;

const discountAmount = basePrice * quantity * discount;
const finalPrice = (basePrice * quantity) - discountAmount;

return [{
  json: {
    quantity,
    basePrice,
    discountPercentage: discount * 100,
    discountAmount,
    finalPrice,
    savings: discountAmount
  }
}];
\`\`\`

## Security Considerations

### Available Security Features
\`\`\`javascript
// ✅ Crypto IS available despite editor warnings!
const crypto = require('crypto');

// Generate secure random values
const randomBytes = crypto.randomBytes(32);
const randomUUID = crypto.randomUUID();

// Create hashes
const hash = crypto.createHash('sha256')
  .update('data to hash')
  .digest('hex');

// HMAC for signatures
const hmac = crypto.createHmac('sha256', 'secret-key')
  .update('data to sign')
  .digest('hex');
\`\`\`

### Banned Operations
- No file system access (fs module) - except read-only for some paths
- No network requests except via $helpers.httpRequest
- No child process execution
- No external npm packages (only built-in Node.js modules)
- No eval() or Function() constructor

### Safe Practices
\`\`\`javascript
// ✅ SAFE - Use crypto for secure operations
const crypto = require('crypto');
const token = crypto.randomBytes(32).toString('hex');

// ✅ SAFE - Use built-in JSON parsing
const parsed = JSON.parse(jsonString);

// ❌ UNSAFE - Never use eval
const parsed = eval('(' + jsonString + ')');

// ✅ SAFE - Validate input
if (typeof item.json.userId !== 'string') {
  throw new Error('userId must be a string');
}

// ✅ SAFE - Sanitize for logs
const safeLog = String(userInput).substring(0, 100);

// ✅ SAFE - Time-safe comparison for secrets
const expectedToken = 'abc123';
const providedToken = item.json.token;
const tokensMatch = crypto.timingSafeEqual(
  Buffer.from(expectedToken),
  Buffer.from(providedToken || '')
);
\`\`\`

## Debugging Tips

### Console Output
\`\`\`javascript
// Console.log appears in n8n execution logs
console.log('Processing item:', item.json.id);
console.error('Error details:', error);

// Return debug info in development
return [{
  json: {
    result: processedData,
    debug: {
      itemCount: items.length,
      executionId: $execution.id,
      timestamp: new Date().toISOString()
    }
  }
}];
\`\`\`

### Error Messages
\`\`\`javascript
// Provide helpful error context
if (!item.json.requiredField) {
  throw new Error(\`Missing required field 'requiredField' in item \${items.indexOf(item)}\`);
}

// Include original data in errors
try {
  // processing...
} catch (error) {
  throw new Error(\`Failed to process item \${item.json.id}: \${error.message}\`);
}
\`\`\`

## Performance Best Practices

1. **Avoid nested loops** when possible
2. **Use array methods** (map, filter, reduce) for clarity
3. **Limit HTTP requests** - batch when possible
4. **Return early** for error conditions
5. **Keep state minimal** - Code nodes are stateless between executions

## Common Mistakes to Avoid

1. **Forgetting to return an array**
2. **Not wrapping in json property**
3. **Modifying items array directly**
4. **Using undefined variables**
5. **Infinite loops with while statements**
6. **Not handling missing data gracefully**
7. **Forgetting await for async operations**`,
      parameters: {
        topic: { type: 'string', description: 'Specific Code node topic (optional)', required: false }
      },
      returns: 'Comprehensive Code node documentation and examples',
      examples: [
        'tools_documentation({topic: "code_node_guide"}) - Full guide',
        'tools_documentation({topic: "code_node_guide", depth: "full"}) - Complete reference'
      ],
      useCases: [
        'Learning Code node capabilities',
        'Understanding built-in variables',
        'Finding the right helper function',
        'Debugging Code node issues',
        'Building custom AI tools'
      ],
      performance: 'Instant - returns static documentation',
      bestPractices: [
        'Read before writing Code nodes',
        'Reference for variable names',
        'Copy examples as starting points',
        'Check security considerations'
      ],
      pitfalls: [
        'Not all Node.js features available',
        'Python has limited libraries',
        'State not preserved between executions'
      ],
      relatedTools: ['get_node_essentials', 'validate_node_operation', 'get_node_for_task']
    }
  }
};

export function getToolDocumentation(toolName: string, depth: 'essentials' | 'full' = 'essentials'): string {
  const tool = toolsDocumentation[toolName];
  if (!tool) {
    return `Tool '${toolName}' not found. Use tools_documentation() to see available tools.`;
  }

  if (depth === 'essentials') {
    const { essentials } = tool;
    return `# ${tool.name}

${essentials.description}

**Example**: ${essentials.example}

**Key parameters**: ${essentials.keyParameters.join(', ')}

**Performance**: ${essentials.performance}

**Tips**:
${essentials.tips.map(tip => `- ${tip}`).join('\n')}

For full documentation, use: tools_documentation({topic: "${toolName}", depth: "full"})`;
  }

  // Full documentation
  const { full } = tool;
  return `# ${tool.name}

${full.description}

## Parameters
${Object.entries(full.parameters).map(([param, info]) => 
  `- **${param}** (${info.type}${info.required ? ', required' : ''}): ${info.description}`
).join('\n')}

## Returns
${full.returns}

## Examples
${full.examples.map(ex => `\`\`\`javascript\n${ex}\n\`\`\``).join('\n\n')}

## Common Use Cases
${full.useCases.map(uc => `- ${uc}`).join('\n')}

## Performance
${full.performance}

## Best Practices
${full.bestPractices.map(bp => `- ${bp}`).join('\n')}

## Common Pitfalls
${full.pitfalls.map(p => `- ${p}`).join('\n')}

## Related Tools
${full.relatedTools.map(t => `- ${t}`).join('\n')}`;
}

export function getToolsOverview(depth: 'essentials' | 'full' = 'essentials'): string {
  if (depth === 'essentials') {
    return `# n8n MCP Tools Quick Reference

Welcome! Here's how to efficiently work with n8n nodes:

## Essential Workflow
1. **Find**: search_nodes({query: "slack"})
2. **Configure**: get_node_essentials("n8n-nodes-base.slack")  
3. **Validate**: validate_node_minimal() → validate_node_operation()
4. **Deploy**: n8n_create_workflow() (if API configured)

## Key Tips
- Always use get_node_essentials instead of get_node_info (95% smaller!)
- Use node NAMES in connections, never IDs
- Try get_node_for_task() for common patterns
- Call validate_node_minimal() for quick checks

## Get Help
- tools_documentation({topic: "search_nodes"}) - Get help for specific tool
- tools_documentation({topic: "code_node_guide"}) - Essential Code node reference
- tools_documentation({topic: "overview", depth: "full"}) - See complete guide
- list_tasks() - See available task templates

Available tools: ${Object.keys(toolsDocumentation).join(', ')}`;
  }

  // Full overview
  return `# n8n MCP Tools Complete Guide

## Overview
The n8n MCP provides 39 tools to help you discover, configure, validate, and deploy n8n workflows. Tools are organized into categories for easy discovery.

## Tool Categories

### Discovery Tools
- **search_nodes**: Find nodes by keyword (uses OR logic)
- **list_nodes**: Browse nodes by category, package, or type
- **list_ai_tools**: See all AI-capable nodes (263 available)

### Configuration Tools  
- **get_node_essentials**: Get key properties only (<5KB vs 100KB+)
- **get_node_info**: Get complete node details (use sparingly)
- **search_node_properties**: Find specific properties in large nodes
- **get_property_dependencies**: Understand field relationships

### Validation Tools
- **validate_node_minimal**: Quick required field check
- **validate_node_operation**: Full operation-aware validation
- **validate_workflow**: Complete workflow validation
- **validate_workflow_connections**: Check node connections
- **validate_workflow_expressions**: Validate n8n expressions

### Task & Template Tools
- **list_tasks**: See available task templates
- **get_node_for_task**: Get pre-configured nodes
- **list_node_templates**: Find workflow templates
- **search_templates**: Search template library

### Workflow Management (requires API config)
- **n8n_create_workflow**: Create new workflows
- **n8n_update_partial_workflow**: Efficient diff-based updates
- **n8n_update_full_workflow**: Replace entire workflow
- **n8n_list_workflows**: List workflows with filtering

## Recommended Patterns

### Building a Simple Workflow
\`\`\`javascript
// 1. Find what you need
search_nodes({query: "webhook"})
search_nodes({query: "slack"})

// 2. Get configurations
get_node_essentials("n8n-nodes-base.webhook")
get_node_essentials("n8n-nodes-base.slack")

// 3. Build and validate
const workflow = {
  name: "My Webhook to Slack",
  nodes: [...],
  connections: {"Webhook": {main: [[{node: "Slack", type: "main", index: 0}]]}}
};
validate_workflow(workflow)

// 4. Deploy (if API configured)
n8n_create_workflow(workflow)
\`\`\`

### Working with Code Nodes
The Code node is essential for custom logic. Always reference the guide:
\`\`\`javascript
// Get comprehensive Code node documentation
tools_documentation({topic: "code_node_guide"})

// Common Code node pattern
get_node_essentials("n8n-nodes-base.code")
// Returns minimal config with JavaScript/Python examples

// Validate Code node configuration
validate_node_operation("n8n-nodes-base.code", {
  language: "javaScript",
  jsCode: "return items.map(item => ({json: {...item.json, processed: true}}))"
})
\`\`\`

### Node-Level Properties Reference
⚠️ **CRITICAL**: These properties go at the NODE level, not inside parameters!

\`\`\`javascript
{
  // Required properties
  "id": "unique_id",
  "name": "Node Name",
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.6,
  "position": [450, 300],
  "parameters": { /* operation-specific params */ },
  
  // Optional properties (all at node level!)
  "credentials": {
    "postgres": {
      "id": "cred-id",
      "name": "My Postgres"
    }
  },
  "disabled": false,              // Disable node execution
  "notes": "Internal note",       // Node documentation
  "notesInFlow": true,           // Show notes on canvas
  "executeOnce": true,           // Execute only once per run
  
  // Error handling (at node level!)
  "onError": "continueErrorOutput",  // or "continueRegularOutput", "stopWorkflow"
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 2000,
  "alwaysOutputData": true,
  
  // Deprecated (use onError instead)
  "continueOnFail": false
}
\`\`\`

**Common properties explained:**
- **credentials**: Links to credential sets (use credential ID and name)
- **disabled**: Node won't execute when true
- **notes**: Internal documentation for the node
- **notesInFlow**: Display notes on workflow canvas
- **executeOnce**: Execute node only once even with multiple input items
- **onError**: Modern error handling - what to do on failure
- **retryOnFail**: Automatically retry failed executions
- **maxTries**: Number of retry attempts (with retryOnFail)
- **waitBetweenTries**: Milliseconds between retries
- **alwaysOutputData**: Output data even on error (for debugging)

### Using AI Tools
Any node can be an AI tool! Connect it to an AI Agent's ai_tool port:
\`\`\`javascript
get_node_as_tool_info("n8n-nodes-base.slack")
// Returns how to configure Slack as an AI tool
\`\`\`

### Efficient Updates
Use partial updates to save 80-90% bandwidth:
\`\`\`javascript
n8n_update_partial_workflow({
  id: "workflow-id",
  operations: [
    {type: "updateNode", nodeId: "Slack", updates: {parameters: {channel: "general"}}}
  ]
})
\`\`\`

## Performance Guide
- **Fastest**: get_node_essentials, validate_node_minimal, list_tasks
- **Fast**: search_nodes, list_nodes, get_node_for_task  
- **Moderate**: validate_node_operation, n8n_update_partial_workflow
- **Slow**: get_node_info (100KB+), validate_workflow (full analysis)

## Common Pitfalls to Avoid
1. Using get_node_info when get_node_essentials would work
2. Using node IDs instead of names in connections
3. Not validating before creating workflows
4. Searching with long phrases instead of keywords
5. Forgetting to configure N8N_API_URL for management tools

## Getting More Help
- Use tools_documentation({topic: "toolname"}) for any tool
- Check CLAUDE.md for latest updates and examples
- Run n8n_health_check() to verify API connectivity`;
}

export function searchToolDocumentation(query: string): string[] {
  const results: string[] = [];
  const searchTerms = query.toLowerCase().split(' ');
  
  for (const [toolName, tool] of Object.entries(toolsDocumentation)) {
    const searchText = `${toolName} ${tool.essentials.description} ${tool.category}`.toLowerCase();
    if (searchTerms.some(term => searchText.includes(term))) {
      results.push(toolName);
    }
  }
  
  return results;
}

export function getToolsByCategory(category: string): string[] {
  return Object.entries(toolsDocumentation)
    .filter(([_, tool]) => tool.category === category)
    .map(([name, _]) => name);
}

export function getAllCategories(): string[] {
  const categories = new Set<string>();
  Object.values(toolsDocumentation).forEach(tool => {
    categories.add(tool.category);
  });
  return Array.from(categories);
}