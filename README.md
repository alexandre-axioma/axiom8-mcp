# axiom8-mcp

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](https://github.com/alexandrevitormoraisdasilva/axiom8-mcp)
[![n8n version](https://img.shields.io/badge/n8n-v1.100.1-orange.svg)](https://github.com/n8n-io/n8n)
[![Docker](https://img.shields.io/badge/docker-ready-green.svg)](https://www.docker.com/)

**AI-Powered n8n Documentation Server with Semantic Search**

axiom8-mcp provides Claude and other AI assistants with intelligent access to n8n's complete workflow automation knowledge base through semantic search, hybrid retrieval, and AI-powered understanding.

## 🙏 Built on Solid Foundations

This project builds upon the excellent work of [Romuald Czlonkowski](https://github.com/czlonkowski/n8n-mcp), who created the original n8n-MCP server. Axioma has enhanced the original with hybrid search technology, semantic understanding, and AI-powered retrieval capabilities. All credit for the foundational architecture and initial implementation goes to the original author - we're standing on the shoulders of giants to make n8n knowledge even more accessible to AI assistants.

## ✨ What Makes axiom8-mcp Special

🧠 **Semantic Search**: Understands intent, not just keywords  
🔍 **Hybrid Retrieval**: Combines text search + AI embeddings + reranking  
📚 **Complete Coverage**: 525+ n8n nodes with full documentation  
🤖 **AI-Optimized**: Built specifically for AI assistant integration  
🚀 **Production Ready**: Validates workflows before deployment  

### Traditional Search vs Semantic Search

| Traditional Query | Semantic Understanding |
|-------------------|----------------------|
| "email nodes" → finds nodes with "email" in name | "process customer feedback" → finds Survey, Email, Slack, Database nodes |
| "http request" → finds HTTP Request node | "call an API" → finds HTTP Request, Webhook, cURL nodes + examples |
| "database" → finds Database node | "store user data" → finds Database, Airtable, Google Sheets + configuration |

## 🚀 Quick Start

**New to axiom8-mcp?** Follow our [Complete Installation Guide](./INSTALLATION_GUIDE.md) for step-by-step setup from zero.

### 5-Minute Setup

1. **Get API Keys** (optional, for semantic search):
   - [OpenAI API Key](https://platform.openai.com/api-keys)
   - [Cohere API Key](https://dashboard.cohere.ai/api-keys) (free tier available)

2. **Build & Configure**:
   ```bash
   git clone https://github.com/alexandre-axioma/axiom8-mcp.git
   cd axiom8-mcp
   docker build -t axiom8-mcp:latest .
   ```

3. **Add to Claude Desktop**:
   ```json
   {
     "mcpServers": {
       "axiom8-mcp": {
         "command": "docker",
         "args": [
           "run", "-i", "--rm",
           "-e", "MCP_MODE=stdio",
           "-e", "ENABLE_SEMANTIC_SEARCH=true",
           "-e", "OPENAI_API_KEY=your-key-here",
           "-e", "COHERE_API_KEY=your-key-here",
           "axiom8-mcp:latest"
         ]
       }
     }
   }
   ```

4. **Add to Claude Code**:
   ```bash
   claude mcp add-json axiom8-mcp '{
     "command": "docker",
     "args": [
       "run", "-i", "--rm",
       "-e", "MCP_MODE=stdio",
       "-e", "ENABLE_SEMANTIC_SEARCH=true",
       "-e", "OPENAI_API_KEY=your-key-here",
       "-e", "COHERE_API_KEY=your-key-here",
       "axiom8-mcp:latest"
     ]
   }'
   ```

5. **Test**: Ask Claude: "Search for nodes that help process customer data"

## 🎯 Usage Examples

### Smart Node Discovery
```
Claude: "I need to process emails and extract attachments"
→ Finds: Gmail, Email, File operations, with working examples
```

### Intelligent Configuration  
```
Claude: "Configure HTTP Request node for OAuth API calls"
→ Returns: Complete setup with authentication examples
```

### Workflow Intelligence
```
Claude: "Build a workflow that monitors webhooks and saves data"
→ Suggests: Webhook → Filter → Database with full configuration
```

## 🔧 Configuration Modes

### Full Power Mode (Recommended)
```json
"-e", "ENABLE_SEMANTIC_SEARCH=true",
"-e", "ENABLE_COHERE_RERANKING=true",
"-e", "OPENAI_API_KEY=sk-...",
"-e", "COHERE_API_KEY=..."
```
**Benefits**: Best search quality, understands complex queries with hybrid search

### Free Mode
```json
"-e", "ENABLE_SEMANTIC_SEARCH=false"
```
**Benefits**: Traditional text search, no API keys needed

## 📊 Performance Comparison

| Feature | axiom8-mcp | Traditional Search |
|---------|-------------|-------------------|
| **Search Quality** | Intent-based, contextual | Keyword matching only |
| **Query Understanding** | "help with customer data" ✓ | Needs exact keywords |
| **Configuration Examples** | Working examples included | Generic documentation |
| **Workflow Validation** | Pre-deployment validation | Manual testing only |
| **AI Integration** | Built for AI assistants | Human-oriented docs |

## 🧠 Available Tools

### 🔍 Search & Discovery (Hybrid Search Enabled)
- `search_nodes` - **Hybrid search** across 525+ nodes with intent understanding
- `search_templates` - **Hybrid search** through 499+ community workflow templates  
- `list_nodes` - Browse nodes by category, package, or AI capability
- `get_node_essentials` - Lightweight node info (5KB vs 100KB+ full schema)
- `search_node_properties` - Find specific properties (auth, headers, body) across nodes
- `get_database_statistics` - Overview of available nodes and coverage

### ⚙️ Node Configuration & Information
- `get_node_info` - Complete node schema with all properties and operations
- `get_node_documentation` - Human-readable docs with examples and patterns
- `get_node_for_task` - Pre-configured nodes for common tasks (send_slack_message, etc.)
- `get_property_dependencies` - Understand which properties enable others

### 🤖 AI Tools & Task Management  
- `list_ai_tools` - 263+ nodes optimized for AI agent usage
- `get_node_as_tool_info` - Guide for using any node as an AI tool
- `list_tasks` - 29+ task templates organized by category (HTTP/API, Database, AI/LangChain, Communication)

### ✅ Validation & Quality Assurance
- `validate_workflow` - Complete workflow validation (structure + connections + expressions)
- `validate_workflow_connections` - Fast connection and flow validation
- `validate_workflow_expressions` - n8n expression syntax checking  
- `validate_node_operation` - Full node configuration validation with suggestions
- `validate_node_minimal` - Quick check for missing required fields

### 📚 Templates & Workflows
- `get_template` - Download complete workflow JSON ready to import
- `list_node_templates` - Find templates using specific nodes
- `get_templates_for_task` - Curated templates by task type (ai_automation, data_sync, etc.)

## 🏗️ Architecture

```
Claude Desktop
    ↓ (MCP Protocol)
axiom8-mcp Server
    ↓ (Hybrid Search)
┌─────────────────────┐
│ FTS5 Text Search    │ ← Keywords, exact matches
│ + Vector Embeddings │ ← Semantic understanding  
│ + RRF Fusion        │ ← Combines both results
│ + Cohere Reranking  │ ← Final quality boost
└─────────────────────┘
    ↓
Pre-built Knowledge Base
• 525 n8n nodes
• 499+ workflow templates  
• Documentation & examples
• AI tool configurations
```

## 🔍 Technical Details

### Hybrid Search Engine
- **FTS5**: SQLite full-text search for exact matches
- **OpenAI Embeddings**: text-embedding-3-small for semantic understanding
- **RRF Fusion**: Combines results using Reciprocal Rank Fusion
- **Cohere Reranking**: rerank-multilingual-v3.0 for final optimization

### Database
- **Pre-embedded**: 525 nodes + 499 templates with embeddings ready
- **SQLite BLOB storage**: Efficient vector storage
- **Content hashing**: Incremental updates only when needed
- **Zero-downtime**: Atomic database operations

### Performance
- **Search latency**: ~100-200ms with semantic search
- **Database size**: ~50MB with embeddings
- **Memory usage**: ~100MB runtime

## 📚 Documentation

- **[Complete Installation Guide](./INSTALLATION_GUIDE.md)** - Step-by-step setup from zero


## 🚨 Troubleshooting

### Common Issues

**"No semantic search results"**
- Check API keys are valid
- Verify OpenAI account has credits
- Test with basic mode first

**"Docker image not found"**
```bash
docker build -t axiom8-mcp:latest .
```

**"Claude Desktop not connecting"**
- Validate JSON configuration
- Restart Claude Desktop completely
- Check Docker is running

### Debug Steps
1. Test Docker image: `docker run --rm axiom8-mcp:latest`
2. Validate config JSON at [jsonlint.com](https://jsonlint.com)
3. Check API keys independently
4. Enable debug logging: `"LOG_LEVEL=debug"`


## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

**Original Author**: Special thanks to [Romuald Czlonkowski](https://github.com/czlonkowski/n8n-mcp) for creating the original n8n-MCP server that serves as the foundation for this project.

**Enhanced by**: [Axioma](https://axioma.ai) - We've added hybrid search, semantic understanding, and AI-powered retrieval capabilities to make n8n knowledge even more accessible to AI assistants.

---

**Ready to give your AI assistant superhuman n8n knowledge?** Start with our [Installation Guide](./INSTALLATION_GUIDE.md)!