# axiom8-mcp Tools Documentation

Comprehensive reference for all axiom8-mcp tools, organized by functionality and use cases.

## 📋 Quick Reference

| Tool Category | Tool Count | Performance | Use Cases |
|---------------|------------|-------------|-----------|
| [Search & Discovery](#-search--discovery) | 6 | Fast-Moderate | Finding nodes, templates, properties |
| [Node Configuration](#%EF%B8%8F-node-configuration--information) | 4 | Fast-Slow | Getting node details, documentation |
| [AI Tools & Tasks](#-ai-tools--task-management) | 3 | Fast | AI integration, task templates |
| [Validation](#-validation--quality-assurance) | 5 | Fast-Moderate | Workflow validation, error checking |
| [Templates](#-templates--workflows) | 3 | Fast-Moderate | Finding and using workflow templates |

**Total: 21 tools** | **Hybrid Search**: 2 tools | **AI Optimized**: 263+ nodes available

---

## 🔍 Search & Discovery

### `search_nodes`
**Hybrid search across 525+ n8n nodes with intent understanding**

#### Parameters:
- `query` (string, required): Search terms or natural language query
- `limit` (number, optional): Maximum results (default: 20, max: 100)
- `mode` (string, optional): Search mode - "OR" (default), "AND", "FUZZY"

#### How it works:
- **Hybrid Search**: Combines FTS5 full-text search + semantic embeddings + RRF fusion + Cohere reranking
- **Intent Understanding**: "process customer data" → finds relevant nodes beyond keyword matches
- **Relevance Scoring**: Returns `cohereScore` and `cohereRank` for result quality

#### Examples:
```javascript
// Basic keyword search
search_nodes({query: "webhook"})

// Natural language query
search_nodes({query: "process customer feedback", limit: 5})

// AND mode for precise matching
search_nodes({query: "email send", mode: "AND"})
```

#### Returns:
```javascript
{
  "query": "webhook",
  "results": [
    {
      "nodeType": "nodes-base.webhook",
      "displayName": "Webhook",
      "description": "Starts the workflow when a webhook is called",
      "category": "trigger",
      "relevance": 0.994292,
      "searchMethod": "hybrid",
      "metadata": {
        "ftsRank": 1,
        "cohereScore": 0.994292,
        "cohereRank": 1,
        "rerankQuery": "webhook"
      }
    }
  ],
  "totalCount": 1,
  "searchEngine": "hybrid"
}
```

#### Performance: ⚡ Fast (~100-200ms with semantic search)

---

### `search_templates`
**Hybrid search through 499+ community workflow templates**

#### Parameters:
- `query` (string, required): Search terms for template names/descriptions
- `limit` (number, optional): Maximum results (default: 20)

#### How it works:
- **Hybrid Search**: Same technology as `search_nodes` but for workflow templates
- **Community Content**: Searches through n8n.io template library
- **Rich Metadata**: Returns author info, view counts, creation dates

#### Examples:
```javascript
// Find chatbot templates
search_templates({query: "chatbot", limit: 3})

// Specific workflow types
search_templates({query: "webhook automation"})
```

#### Returns:
```javascript
{
  "query": "chatbot",
  "templates": [
    {
      "id": 4645,
      "workflowId": 4645,
      "name": "Create AI-Powered Website Chatbot",
      "description": "This workflow integrates a chatbot frontend...",
      "author": {
        "name": "Davide",
        "username": "n3witalia",
        "verified": true
      },
      "nodesUsed": ["n8n-nodes-base.httpRequest"],
      "relevanceScore": 0.9928231,
      "searchMethod": "hybrid",
      "metadata": {
        "views": 1702,
        "createdAt": "2025-06-04T10:02:44.761Z"
      }
    }
  ],
  "count": 1,
  "searchMethod": "hybrid"
}
```

#### Performance: ⚡ Fast

---

### `list_nodes`
**Browse nodes by category, package, or capability**

#### Parameters:
- `limit` (number, optional): Maximum results (default: 50, use 200+ for all)
- `category` (string, optional): Filter by category - "trigger", "transform", "output", "input", "AI"
- `package` (string, optional): "n8n-nodes-base" (core) or "@n8n/n8n-nodes-langchain" (AI)
- `developmentStyle` (string, optional): Usually "programmatic"
- `isAITool` (boolean, optional): Filter AI-capable nodes

#### Examples:
```javascript
// Get all trigger nodes
list_nodes({category: "trigger", limit: 100})

// AI-capable nodes only
list_nodes({isAITool: true, limit: 50})

// All LangChain nodes
list_nodes({package: "@n8n/n8n-nodes-langchain"})
```

#### Returns:
```javascript
{
  "nodes": [
    {
      "nodeType": "nodes-base.webhook",
      "displayName": "Webhook",
      "description": "Starts the workflow when a webhook is called",
      "category": "trigger",
      "package": "n8n-nodes-base",
      "isAITool": false,
      "isTrigger": true,
      "isVersioned": true
    }
  ],
  "totalCount": 1
}
```

#### Performance: ⚡ Fast

---

### `get_node_essentials`
**Lightweight node info (5KB vs 100KB+ full schema)**

#### Parameters:
- `nodeType` (string, required): Full node type with prefix (e.g., "nodes-base.httpRequest")

#### What you get:
- **Required Properties**: Only fields that must be configured
- **Common Properties**: Most frequently used optional fields
- **Examples**: Minimal, common, and advanced configuration examples
- **Metadata**: Performance info, capabilities, package details

#### Examples:
```javascript
// Get HTTP Request essentials
get_node_essentials("nodes-base.httpRequest")

// Get Slack essentials
get_node_essentials("nodes-base.slack")
```

#### Returns:
```javascript
{
  "nodeType": "nodes-base.httpRequest",
  "displayName": "HTTP Request",
  "requiredProperties": [
    {
      "name": "url",
      "displayName": "URL",
      "type": "string",
      "required": true,
      "usageHint": "Enter the full URL including https://"
    }
  ],
  "commonProperties": [...],
  "examples": {
    "minimal": {
      "url": "https://api.example.com/data"
    },
    "common": {
      "method": "POST",
      "url": "https://api.example.com/users",
      "sendBody": true,
      "contentType": "json",
      "jsonBody": "{\n  \"name\": \"John Doe\"\n}"
    }
  },
  "metadata": {
    "totalProperties": 42,
    "isAITool": false,
    "hasCredentials": true
  }
}
```

#### Performance: ⚡ Fast
#### Use case: **Always prefer this over `get_node_info` for basic configuration**

---

### `search_node_properties`
**Find specific properties across nodes**

#### Parameters:
- `nodeType` (string, required): Full node type with prefix
- `query` (string, required): Property to find - "auth", "header", "body", "json"
- `maxResults` (number, optional): Maximum results (default: 20)

#### Examples:
```javascript
// Find authentication options in HTTP Request
search_node_properties({
  nodeType: "nodes-base.httpRequest",
  query: "auth"
})

// Find header-related properties
search_node_properties({
  nodeType: "nodes-base.httpRequest", 
  query: "header"
})
```

#### Performance: ⚡ Fast

---

### `get_database_statistics`
**Overview of available nodes and coverage**

#### Parameters: None

#### Returns:
```javascript
{
  "totalNodes": 526,
  "statistics": {
    "aiTools": 263,
    "triggers": 108,
    "versionedNodes": 128,
    "nodesWithDocumentation": 473,
    "documentationCoverage": "90%",
    "uniquePackages": 2,
    "uniqueCategories": 5
  },
  "packageBreakdown": [
    {
      "package": "n8n-nodes-base",
      "nodeCount": 435
    },
    {
      "package": "@n8n/n8n-nodes-langchain",
      "nodeCount": 91
    }
  ]
}
```

#### Performance: ⚡ Fast
#### Use case: **Health check and overview of available resources**

---

## ⚙️ Node Configuration & Information

### `get_node_info`
**Complete node schema with all properties and operations**

#### Parameters:
- `nodeType` (string, required): Full node type with prefix

#### ⚠️ **Warning**: Returns 100KB+ of data. Use `get_node_essentials` for most cases.

#### When to use:
- Need complete property list with all edge cases
- Building node editors or documentation tools
- Deep integration requiring full schema

#### Performance: 🐌 Slow (large response)

---

### `get_node_documentation`
**Human-readable docs with examples and patterns**

#### Parameters:
- `nodeType` (string, required): Full node type with prefix

#### What you get:
- **Rich Documentation**: Human-written guides and examples
- **API References**: Required scopes, method mappings
- **Setup Instructions**: Step-by-step configuration guides
- **Coverage**: 87% of nodes have documentation

#### Examples:
```javascript
// Get Slack documentation
get_node_documentation("nodes-base.slack")
```

#### Returns:
```javascript
{
  "nodeType": "nodes-base.slack",
  "displayName": "Slack",
  "documentation": "# Slack node\n\nUse the Slack node to automate work in Slack...",
  "hasDocumentation": true
}
```

#### Performance: ⚡ Fast
#### Use case: **Better than raw schema for understanding node capabilities**

---

### `get_node_for_task`
**Pre-configured nodes for common tasks**

#### Parameters:
- `task` (string, required): Task name (see `list_tasks` for options)

#### Available tasks:
- `send_slack_message`, `send_email`, `get_api_data`
- `post_json_request`, `receive_webhook`
- `query_postgres`, `chat_with_ai`
- And 22 more...

#### Examples:
```javascript
// Get configured Slack message node
get_node_for_task("send_slack_message")
```

#### Returns:
```javascript
{
  "task": "send_slack_message",
  "nodeType": "nodes-base.slack",
  "configuration": {
    "resource": "message",
    "operation": "post",
    "channel": "",
    "text": "",
    "onError": "continueRegularOutput",
    "retryOnFail": true,
    "maxTries": 2,
    "waitBetweenTries": 2000
  },
  "userMustProvide": [
    {
      "property": "channel",
      "description": "The Slack channel",
      "example": "#general"
    }
  ],
  "optionalEnhancements": [
    {
      "property": "attachments",
      "description": "Add rich message attachments"
    }
  ]
}
```

#### Performance: ⚡ Fast
#### Use case: **Quick start for common configurations**

---

### `get_property_dependencies`
**Understand which properties enable others**

#### Parameters:
- `nodeType` (string, required): Node type to analyze
- `config` (object, optional): Partial configuration to test visibility

#### What it reveals:
- **Property Dependencies**: Which fields show/hide based on other settings
- **Visibility Rules**: Complex conditional logic (e.g., `sendBody=true` reveals body fields)
- **Dependency Graph**: Complete map of property relationships

#### Examples:
```javascript
// See what sendBody=true enables in HTTP Request
get_property_dependencies({
  nodeType: "nodes-base.httpRequest",
  config: {"sendBody": true}
})
```

#### Returns:
```javascript
{
  "nodeType": "nodes-base.httpRequest",
  "totalProperties": 42,
  "propertiesWithDependencies": 32,
  "dependencies": [
    {
      "property": "contentType",
      "dependsOn": [
        {
          "property": "sendBody",
          "values": [true],
          "condition": "equals"
        }
      ],
      "enablesProperties": ["jsonBody", "bodyParameters"]
    }
  ],
  "dependencyGraph": {
    "sendBody": ["contentType", "specifyBody", "bodyParameters"]
  }
}
```

#### Performance: ⚡ Fast
#### Use case: **Essential for building dynamic forms or understanding complex nodes**

---

## 🤖 AI Tools & Task Management

### `list_ai_tools`
**263+ nodes optimized for AI agent usage**

#### Parameters: None

#### What it shows:
- **AI-Optimized Nodes**: Nodes with `isAITool: true`
- **Important Note**: ANY node can be an AI tool by connecting to AI Agent's tool port
- **Requirements**: Community nodes need `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`

#### Returns:
```javascript
{
  "tools": [
    {
      "nodeType": "nodes-base.aiTransform",
      "displayName": "AI Transform",
      "description": "Modify data based on instructions written in plain english",
      "package": "n8n-nodes-base"
    }
  ],
  "totalCount": 263,
  "requirements": {
    "environmentVariable": "N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true",
    "nodeProperty": "usableAsTool: true"
  }
}
```

#### Performance: ⚡ Fast

---

### `get_node_as_tool_info`
**Guide for using any node as an AI tool**

#### Parameters:
- `nodeType` (string, required): Full node type with prefix

#### What you get:
- **Connection Instructions**: How to connect to AI Agent's tool port
- **Configuration Template**: Pre-configured setup for AI usage
- **Use Cases**: Common scenarios for this node as an AI tool
- **Requirements**: Environment variables or special setup needed

#### Examples:
```javascript
// Learn how to use Slack as AI tool
get_node_as_tool_info("nodes-base.slack")
```

#### Returns:
```javascript
{
  "nodeType": "nodes-base.slack",
  "aiToolCapabilities": {
    "canBeUsedAsTool": true,
    "requiresEnvironmentVariable": false,
    "connectionType": "ai_tool",
    "commonUseCases": [
      "Send notifications about task completion",
      "Post updates to channels",
      "Send direct messages"
    ],
    "examples": {
      "toolName": "Send Slack Message",
      "toolDescription": "Sends a message to a specified Slack channel",
      "nodeConfig": {
        "resource": "message",
        "operation": "post",
        "channel": "={{ $fromAI(\"channel\", \"The Slack channel to send to\") }}",
        "text": "={{ $fromAI(\"message\", \"The message content\") }}"
      }
    },
    "tips": [
      "Give the tool a clear, descriptive name",
      "Write a detailed tool description",
      "Test the node independently first"
    ]
  }
}
```

#### Performance: ⚡ Fast
#### Use case: **Essential for AI agent workflows**

---

### `list_tasks`
**29+ task templates organized by category**

#### Parameters:
- `category` (string, optional): Filter by category

#### Available categories:
- **HTTP/API**: API calls, authentication, retries
- **Webhooks**: Webhook handling, responses, error handling  
- **Database**: PostgreSQL operations, transactions
- **AI/LangChain**: AI agents, chat models, rate limiting
- **Data Processing**: Transformations, filtering, fault tolerance
- **Communication**: Slack, email notifications
- **AI Tool Usage**: Using nodes as AI tools
- **Error Handling**: Modern error patterns

#### Examples:
```javascript
// Get all available tasks
list_tasks()

// Get only AI-related tasks
list_tasks({category: "AI/LangChain"})
```

#### Returns:
```javascript
{
  "totalTasks": 29,
  "categories": {
    "HTTP/API": [
      {
        "task": "get_api_data",
        "description": "Make a simple GET request to retrieve data",
        "nodeType": "nodes-base.httpRequest"
      }
    ],
    "Communication": [
      {
        "task": "send_slack_message",
        "description": "Send a message to Slack channel",
        "nodeType": "nodes-base.slack"
      }
    ]
  }
}
```

#### Performance: ⚡ Fast
#### Use case: **Discover pre-built solutions for common workflows**

---

## ✅ Validation & Quality Assurance

### `validate_node_minimal`
**Quick check for missing required fields**

#### Parameters:
- `nodeType` (string, required): Node type to validate
- `config` (object, required): Node configuration to check

#### What it does:
- **Fast Check**: Only validates required fields
- **No Warnings**: Just tells you what's missing
- **Lightweight**: Minimal processing for quick feedback

#### Examples:
```javascript
// Check Slack configuration
validate_node_minimal({
  nodeType: "nodes-base.slack",
  config: {
    "resource": "message",
    "operation": "post"
  }
})
```

#### Returns:
```javascript
{
  "nodeType": "nodes-base.slack",
  "displayName": "Slack",
  "valid": false,
  "missingRequiredFields": [
    "Send Message To"
  ]
}
```

#### Performance: ⚡ Fast
#### Use case: **Quick validation during form building**

---

### `validate_node_operation`
**Full node configuration validation with suggestions**

#### Parameters:
- `nodeType` (string, required): Node type to validate
- `config` (object, required): Node configuration
- `profile` (string, optional): Validation profile - "minimal", "runtime", "ai-friendly" (default), "strict"

#### Validation profiles:
- **minimal**: Only required fields
- **runtime**: Critical errors only
- **ai-friendly**: Balanced approach (default)
- **strict**: All checks including best practices

#### What you get:
- **Errors**: Configuration problems that prevent execution
- **Warnings**: Issues that might cause problems
- **Suggestions**: Best practices and improvements
- **Examples**: Working configurations for reference
- **Next Steps**: Actionable recommendations

#### Examples:
```javascript
// Validate HTTP Request with runtime profile
validate_node_operation({
  nodeType: "nodes-base.httpRequest",
  config: {
    "method": "GET",
    "url": "https://api.example.com"
  },
  profile: "runtime"
})
```

#### Returns:
```javascript
{
  "nodeType": "nodes-base.httpRequest",
  "valid": true,
  "errors": [],
  "warnings": [
    {
      "type": "security",
      "message": "API endpoints typically require authentication",
      "suggestion": "Consider setting authentication if the API requires it"
    }
  ],
  "suggestions": ["Consider setting 'authentication' for better control"],
  "examples": [
    {
      "description": "GET request with query parameters",
      "config": {
        "method": "GET",
        "url": "https://api.example.com/users",
        "queryParameters": {
          "parameters": [{"name": "page", "value": "1"}]
        }
      }
    }
  ],
  "summary": {
    "hasErrors": false,
    "errorCount": 0,
    "warningCount": 1,
    "suggestionCount": 1
  }
}
```

#### Performance: 🔄 Moderate
#### Use case: **Comprehensive validation before deployment**

---

### `validate_workflow`
**Complete workflow validation (structure + connections + expressions)**

#### Parameters:
- `workflow` (object, required): Complete workflow JSON
- `options` (object, optional): Validation settings

#### Validation options:
- `validateNodes` (boolean): Validate individual node configurations (default: true)
- `validateConnections` (boolean): Validate node connections (default: true)  
- `validateExpressions` (boolean): Validate n8n expressions (default: true)
- `profile` (string): Node validation profile (default: "runtime")

#### What it validates:
- **Workflow Structure**: Required fields, proper format
- **Node Configurations**: Each node's settings
- **Connections**: Valid links between nodes, no cycles
- **Expressions**: n8n expression syntax and references
- **AI Tools**: Proper AI agent connections

#### Examples:
```javascript
// Validate complete workflow
validate_workflow({
  workflow: {
    "name": "Test Workflow",
    "nodes": [
      {
        "id": "webhook",
        "type": "n8n-nodes-base.webhook",
        "name": "Webhook",
        "parameters": {"path": "test", "httpMethod": "POST"}
      }
    ],
    "connections": {}
  }
})
```

#### Performance: 🔄 Moderate (depends on workflow size)
#### Use case: **Final validation before deployment**

---

### `validate_workflow_connections`
**Fast connection and flow validation**

#### Parameters:
- `workflow` (object, required): Workflow JSON with nodes and connections

#### What it checks:
- **Valid Connections**: Proper node linking
- **No Cycles**: Prevents infinite loops
- **Trigger Requirements**: Workflows need triggers
- **AI Tool Links**: Proper AI agent connections

#### Examples:
```javascript
// Check workflow connections only
validate_workflow_connections({
  workflow: {
    "nodes": [...],
    "connections": {"Webhook": {"main": [[{"node": "Slack", "type": "main", "index": 0}]]}}
  }
})
```

#### Returns:
```javascript
{
  "valid": true,
  "statistics": {
    "totalNodes": 2,
    "triggerNodes": 1,
    "validConnections": 1,
    "invalidConnections": 0
  }
}
```

#### Performance: ⚡ Fast
#### Use case: **Quick structure check during workflow building**

---

### `validate_workflow_expressions`
**Validate n8n expression syntax and references**

#### Parameters:
- `workflow` (object, required): Workflow JSON to check

#### What it validates:
- **Expression Syntax**: Proper `{{ }}` formatting
- **Variable References**: Valid `$json`, `$node` references
- **Function Calls**: Correct n8n function usage
- **Data Paths**: Valid data access patterns

#### Performance: ⚡ Fast
#### Use case: **Check expressions before workflow execution**

---

## 📚 Templates & Workflows

### `get_template`
**Download complete workflow JSON ready to import**

#### Parameters:
- `templateId` (number, required): Template ID from search results

#### What you get:
- **Complete Workflow**: Full n8n workflow JSON
- **Ready to Import**: Can be directly imported into n8n
- **All Configurations**: Nodes, connections, settings included

#### Examples:
```javascript
// Get specific template by ID
get_template(2465)
```

#### Performance: ⚡ Fast
#### Use case: **Import community workflows into your n8n instance**

---

### `list_node_templates`
**Find templates using specific nodes**

#### Parameters:
- `nodeTypes` (array, required): Full node types with prefix (e.g., ["n8n-nodes-base.httpRequest"])
- `limit` (number, optional): Maximum results (default: 10)

#### Examples:
```javascript
// Find templates using HTTP Request and Slack
list_node_templates({
  nodeTypes: ["n8n-nodes-base.httpRequest", "n8n-nodes-base.slack"]
})
```

#### Returns:
```javascript
{
  "templates": [
    {
      "id": 2465,
      "name": "Building Your First WhatsApp Chatbot",
      "description": "This n8n template builds a simple WhatsApp chatbot...",
      "author": {
        "name": "Jimleuk",
        "verified": true
      },
      "nodes": ["n8n-nodes-base.httpRequest", "n8n-nodes-base.whatsApp"],
      "views": 313191,
      "url": "https://n8n.io/workflows/2465"
    }
  ],
  "count": 1,
  "tip": "Use get_template(templateId) to get the full workflow JSON"
}
```

#### Performance: ⚡ Fast
#### Use case: **Find examples of how specific nodes are used**

---

### `get_templates_for_task`
**Curated templates by task type**

#### Parameters:
- `task` (string, required): Task type

#### Available tasks:
- `ai_automation`: AI agents, chatbots, automation
- `data_sync`: Data integration and synchronization
- `webhook_processing`: Webhook handling workflows
- `email_automation`: Email-based workflows
- `slack_integration`: Slack-focused templates
- `data_transformation`: Data processing workflows
- `file_processing`: File handling automation
- `scheduling`: Time-based workflows
- `api_integration`: API integration patterns
- `database_operations`: Database workflows

#### Examples:
```javascript
// Get AI automation templates
get_templates_for_task("ai_automation")

// Get webhook processing examples
get_templates_for_task("webhook_processing")
```

#### Returns:
```javascript
{
  "task": "ai_automation",
  "templates": [
    {
      "id": 2465,
      "name": "Building Your First WhatsApp Chatbot",
      "description": "WhatsApp chatbot with AI agent...",
      "author": {"name": "Jimleuk", "verified": true},
      "nodes": ["n8n-nodes-base.httpRequest", "n8n-nodes-base.whatsApp"],
      "views": 313191,
      "url": "https://n8n.io/workflows/2465"
    }
  ],
  "count": 10,
  "description": "AI-powered workflows using OpenAI, LangChain, and other AI tools"
}
```

#### Performance: ⚡ Fast
#### Use case: **Find curated examples for specific workflow types**

---

## 🚀 Performance Guide

### ⚡ Fastest Tools
- `get_database_statistics`: Instant overview
- `validate_node_minimal`: Quick field check
- `list_tasks`: Task reference
- `get_node_essentials`: Lightweight node info

### 🔄 Moderate Performance
- `search_nodes`: ~100-200ms with semantic search
- `search_templates`: Hybrid search processing
- `validate_node_operation`: Comprehensive validation
- `get_property_dependencies`: Dependency analysis

### 🐌 Use Sparingly
- `get_node_info`: 100KB+ response size
- `validate_workflow`: Full workflow analysis (depends on size)

---

## 💡 Best Practices

### Efficient Workflows
1. **Start with search**: Use `search_nodes` or `search_templates` to find what you need
2. **Use essentials first**: Always try `get_node_essentials` before `get_node_info`
3. **Validate incrementally**: Use `validate_node_minimal` during building, `validate_node_operation` before deployment
4. **Leverage tasks**: Check `list_tasks` for pre-built solutions

### Common Patterns
```javascript
// 1. Find and configure a node
const nodes = await search_nodes({query: "webhook"});
const essentials = await get_node_essentials(nodes.results[0].nodeType);
const config = essentials.examples.minimal;

// 2. Validate before using
const validation = await validate_node_minimal({
  nodeType: nodes.results[0].nodeType,
  config: config
});

// 3. Get complete workflow template
const templates = await search_templates({query: "webhook automation"});
const workflow = await get_template(templates.templates[0].id);
```

### Troubleshooting
- **No semantic search results**: Check API keys, verify OpenAI credits
- **Validation errors**: Use `get_property_dependencies` to understand field requirements
- **Template issues**: Categories might be empty arrays (known issue)
- **Performance issues**: Use `get_node_essentials` instead of `get_node_info`

---

## 🔗 Related Resources

- **[Installation Guide](../INSTALLATION_GUIDE.md)**: Complete setup instructions
- **[README](../README.md)**: Project overview and quick start
- **n8n Documentation**: [docs.n8n.io](https://docs.n8n.io)
- **Template Library**: [n8n.io/workflows](https://n8n.io/workflows)

---

*This documentation covers all 21 tools available in axiom8-mcp. Each tool is designed to work together for efficient n8n workflow development and automation.*