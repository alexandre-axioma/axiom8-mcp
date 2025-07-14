import { ToolDefinition } from '../types';

/**
 * n8n Documentation MCP Tools - FINAL OPTIMIZED VERSION
 * 
 * Incorporates all lessons learned from real workflow building.
 * Designed to help AI agents avoid common pitfalls and build workflows efficiently.
 */
export const n8nDocumentationToolsFinal: ToolDefinition[] = [
  {
    name: 'tools_documentation',
    description: `Get documentation for n8n MCP tools. Call without parameters for quick start guide. Use topic parameter to get documentation for specific tools. Use depth='full' for comprehensive documentation.`,
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Tool name (e.g., "search_nodes") or "overview" for general guide. Leave empty for quick reference.',
        },
        depth: {
          type: 'string',
          enum: ['essentials', 'full'],
          description: 'Level of detail. "essentials" (default) for quick reference, "full" for comprehensive docs.',
          default: 'essentials',
        },
      },
    },
  },
  {
    name: 'list_nodes',
    description: `List n8n nodes. Common: list_nodes({limit:200}) for all, list_nodes({category:'trigger'}) for triggers. Package: "n8n-nodes-base" or "@n8n/n8n-nodes-langchain". Categories: trigger/transform/output/input.`,
    inputSchema: {
      type: 'object',
      properties: {
        package: {
          type: 'string',
          description: '"n8n-nodes-base" (core) or "@n8n/n8n-nodes-langchain" (AI)',
        },
        category: {
          type: 'string',
          description: 'trigger|transform|output|input|AI',
        },
        developmentStyle: {
          type: 'string',
          enum: ['declarative', 'programmatic'],
          description: 'Usually "programmatic"',
        },
        isAITool: {
          type: 'boolean',
          description: 'Filter AI-capable nodes',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 50, use 200+ for all)',
          default: 50,
        },
      },
    },
  },
  {
    name: 'get_node_info',
    description: `Get FULL node schema (100KB+). TIP: Use get_node_essentials first! Returns all properties/operations/credentials. Prefix required: "nodes-base.httpRequest" not "httpRequest".`,
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: {
          type: 'string',
          description: 'Full type: "nodes-base.{name}" or "nodes-langchain.{name}". Examples: nodes-base.httpRequest, nodes-base.webhook, nodes-base.slack',
        },
      },
      required: ['nodeType'],
    },
  },
  {
    name: 'search_nodes',
    description: `Search nodes by keywords. Modes: OR (any word), AND (all words), FUZZY (typos OK). Primary nodes ranked first. Examples: "webhook"→Webhook, "http call"→HTTP Request.`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search terms. Use quotes for exact phrase.',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 20)',
          default: 20,
        },
        mode: {
          type: 'string',
          enum: ['OR', 'AND', 'FUZZY'],
          description: 'OR=any word, AND=all words, FUZZY=typo-tolerant',
          default: 'OR',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_ai_tools',
    description: `List 263 AI-optimized nodes. Note: ANY node can be AI tool! Connect any node to AI Agent's tool port. Community nodes need N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true.`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_node_documentation',
    description: `Get readable docs with examples/auth/patterns. Better than raw schema! 87% coverage. Format: "nodes-base.slack"`,
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: {
          type: 'string',
          description: 'Full type with prefix: "nodes-base.slack"',
        },
      },
      required: ['nodeType'],
    },
  },
  {
    name: 'get_database_statistics',
    description: `Node stats: 525 total, 263 AI tools, 104 triggers, 87% docs coverage. Verifies MCP working.`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_node_essentials',
    description: `Get 10-20 key properties only (<5KB vs 100KB+). USE THIS FIRST! Includes examples. Format: "nodes-base.httpRequest"`,
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: {
          type: 'string',
          description: 'Full type: "nodes-base.httpRequest"',
        },
      },
      required: ['nodeType'],
    },
  },
  {
    name: 'search_node_properties',
    description: `Find specific properties in a node (auth, headers, body, etc). Returns paths and descriptions.`,
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: {
          type: 'string',
          description: 'Full type with prefix',
        },
        query: {
          type: 'string',
          description: 'Property to find: "auth", "header", "body", "json"',
        },
        maxResults: {
          type: 'number',
          description: 'Max results (default 20)',
          default: 20,
        },
      },
      required: ['nodeType', 'query'],
    },
  },
  {
    name: 'get_node_for_task',
    description: `Get pre-configured node for tasks: post_json_request, receive_webhook, query_database, send_slack_message, etc. Use list_tasks for all.`,
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Task name. See list_tasks for options.',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'list_tasks',
    description: `List task templates by category: HTTP/API, Webhooks, Database, AI, Data Processing, Communication.`,
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category (optional)',
        },
      },
    },
  },
  {
    name: 'validate_node_operation',
    description: `Validate node config. Checks required fields, types, operation rules. Returns errors with fixes. Essential for Slack/Sheets/DB nodes.`,
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: {
          type: 'string',
          description: 'The node type to validate (e.g., "nodes-base.slack")',
        },
        config: {
          type: 'object',
          description: 'Your node configuration. Must include operation fields (resource/operation/action) if the node has multiple operations.',
        },
        profile: {
          type: 'string',
          enum: ['strict', 'runtime', 'ai-friendly', 'minimal'],
          description: 'Validation profile: minimal (only required fields), runtime (critical errors only), ai-friendly (balanced - default), strict (all checks including best practices)',
          default: 'ai-friendly',
        },
      },
      required: ['nodeType', 'config'],
    },
  },
  {
    name: 'validate_node_minimal',
    description: `Fast check for missing required fields only. No warnings/suggestions. Returns: list of missing fields.`,
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: {
          type: 'string',
          description: 'The node type to validate (e.g., "nodes-base.slack")',
        },
        config: {
          type: 'object',
          description: 'The node configuration to check',
        },
      },
      required: ['nodeType', 'config'],
    },
  },
  {
    name: 'get_property_dependencies',
    description: `Shows property dependencies and visibility rules. Example: sendBody=true reveals body fields. Test visibility with optional config.`,
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: {
          type: 'string',
          description: 'The node type to analyze (e.g., "nodes-base.httpRequest")',
        },
        config: {
          type: 'object',
          description: 'Optional partial configuration to check visibility impact',
        },
      },
      required: ['nodeType'],
    },
  },
  {
    name: 'get_node_as_tool_info',
    description: `How to use ANY node as AI tool. Shows requirements, use cases, examples. Works for all nodes, not just AI-marked ones.`,
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: {
          type: 'string',
          description: 'Full node type WITH prefix: "nodes-base.slack", "nodes-base.googleSheets", etc.',
        },
      },
      required: ['nodeType'],
    },
  },
  {
    name: 'list_node_templates',
    description: `Find templates using specific nodes. 399 community workflows. Use FULL types: "n8n-nodes-base.httpRequest".`,
    inputSchema: {
      type: 'object',
      properties: {
        nodeTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of node types to search for (e.g., ["n8n-nodes-base.httpRequest", "n8n-nodes-base.openAi"])',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of templates to return. Default 10.',
          default: 10,
        },
      },
      required: ['nodeTypes'],
    },
  },
  {
    name: 'get_template',
    description: `Get complete workflow JSON by ID. Ready to import. IDs from list_node_templates or search_templates.`,
    inputSchema: {
      type: 'object',
      properties: {
        templateId: {
          type: 'number',
          description: 'The template ID to retrieve',
        },
      },
      required: ['templateId'],
    },
  },
  {
    name: 'search_templates',
    description: `Search templates by name/description keywords. NOT for node types! For nodes use list_node_templates. Example: "chatbot".`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for template names/descriptions. NOT for node types! Examples: "chatbot", "automation", "social media", "webhook". For node-based search use list_node_templates instead.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results. Default 20.',
          default: 20,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_templates_for_task',
    description: `Curated templates by task: ai_automation, data_sync, webhooks, email, slack, data_transform, files, scheduling, api, database.`,
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          enum: [
            'ai_automation',
            'data_sync', 
            'webhook_processing',
            'email_automation',
            'slack_integration',
            'data_transformation',
            'file_processing',
            'scheduling',
            'api_integration',
            'database_operations'
          ],
          description: 'The type of task to get templates for',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'validate_workflow',
    description: `Full workflow validation: structure, connections, expressions, AI tools. Returns errors/warnings/fixes. Essential before deploy.`,
    inputSchema: {
      type: 'object',
      properties: {
        workflow: {
          type: 'object',
          description: 'The complete workflow JSON to validate. Must include nodes array and connections object.',
        },
        options: {
          type: 'object',
          properties: {
            validateNodes: {
              type: 'boolean',
              description: 'Validate individual node configurations. Default true.',
              default: true,
            },
            validateConnections: {
              type: 'boolean',
              description: 'Validate node connections and flow. Default true.',
              default: true,
            },
            validateExpressions: {
              type: 'boolean',
              description: 'Validate n8n expressions syntax and references. Default true.',
              default: true,
            },
            profile: {
              type: 'string',
              enum: ['minimal', 'runtime', 'ai-friendly', 'strict'],
              description: 'Validation profile for node validation. Default "runtime".',
              default: 'runtime',
            },
          },
          description: 'Optional validation settings',
        },
      },
      required: ['workflow'],
    },
  },
  {
    name: 'validate_workflow_connections',
    description: `Check workflow connections only: valid nodes, no cycles, proper triggers, AI tool links. Fast structure validation.`,
    inputSchema: {
      type: 'object',
      properties: {
        workflow: {
          type: 'object',
          description: 'The workflow JSON with nodes array and connections object.',
        },
      },
      required: ['workflow'],
    },
  },
  {
    name: 'validate_workflow_expressions',
    description: `Validate n8n expressions: syntax {{}}, variables ($json/$node), references. Returns errors with locations.`,
    inputSchema: {
      type: 'object',
      properties: {
        workflow: {
          type: 'object',
          description: 'The workflow JSON to check for expression errors.',
        },
      },
      required: ['workflow'],
    },
  },
];

/**
 * QUICK REFERENCE for AI Agents:
 * 
 * 1. RECOMMENDED WORKFLOW:
 *    - Start: search_nodes → get_node_essentials → get_node_for_task → validate_node_operation
 *    - Discovery: list_nodes({category:"trigger"}) for browsing categories
 *    - Quick Config: get_node_essentials("nodes-base.httpRequest") - only essential properties
 *    - Full Details: get_node_info only when essentials aren't enough
 *    - Validation: Use validate_node_operation for complex nodes (Slack, Google Sheets, etc.)
 * 
 * 2. COMMON NODE TYPES:
 *    Triggers: webhook, schedule, emailReadImap, slackTrigger
 *    Core: httpRequest, code, set, if, merge, splitInBatches
 *    Integrations: slack, gmail, googleSheets, postgres, mongodb
 *    AI: agent, openAi, chainLlm, documentLoader
 * 
 * 3. SEARCH TIPS:
 *    - search_nodes returns ANY word match (OR logic)
 *    - Single words more precise, multiple words broader
 *    - If no results: use list_nodes with category filter
 * 
 * 4. TEMPLATE SEARCHING:
 *    - search_templates("slack") searches template names/descriptions, NOT node types!
 *    - To find templates using Slack node: list_node_templates(["n8n-nodes-base.slack"])
 *    - For task-based templates: get_templates_for_task("slack_integration")
 *    - 399 templates available from the last year
 * 
 * 5. KNOWN ISSUES:
 *    - Some nodes have duplicate properties with different conditions
 *    - Package names: use 'n8n-nodes-base' not '@n8n/n8n-nodes-base'
 *    - Check showWhen/hideWhen to identify the right property variant
 * 
 * 6. PERFORMANCE:
 *    - get_node_essentials: Fast (<5KB)
 *    - get_node_info: Slow (100KB+) - use sparingly
 *    - search_nodes/list_nodes: Fast, cached
 */