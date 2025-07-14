# axiom8-mcp Installation Guide

Complete installation guide for axiom8-mcp (n8n Model Context Protocol with semantic search) from zero setup.

## 🎯 What You'll Get

axiom8-mcp provides Claude with comprehensive access to n8n documentation through:
- **Hybrid Search**: Combines traditional text search with AI-powered semantic search
- **525+ n8n nodes**: Complete documentation for every node
- **Smart Configuration**: AI can configure workflows with pre-built examples
- **Template Library**: 499+ workflow templates from n8n.io
- **Workflow Validation**: Validate workflows before deployment

## 📋 Prerequisites

### Required
- **Docker Desktop**: [Download here](https://www.docker.com/products/docker-desktop/)
- **Claude Desktop**: [Download here](https://claude.ai/download)
- **Git**: [Download here](https://git-scm.com/downloads)

### API Keys (for semantic search)
- **OpenAI API Key**: [Get one here](https://platform.openai.com/api-keys)
- **Cohere API Key**: [Get one here](https://dashboard.cohere.ai/api-keys) (free tier available)

## 🚀 Installation Steps

### Step 1: Clone the Repository

```bash
git clone https://github.com/alexandre-axioma/axiom8-mcp.git
cd axiom8-mcp
```

### Step 2: Build the Docker Image

Build the axiom8-mcp image with embedded database:

```bash
# Build the image (this will take 5-10 minutes)
docker build -t axiom8-mcp:latest .
```

**Expected output:**
```
Successfully built abc123def456
Successfully tagged axiom8-mcp:latest
```

### Step 3: Get Your API Keys

#### OpenAI API Key
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Copy the key (starts with `sk-`)
4. Add $5-10 credits to your account

#### Cohere API Key  
1. Go to [Cohere Dashboard](https://dashboard.cohere.ai/api-keys)
2. Sign up for free account
3. Copy your API key

### Step 4: Configure Claude Desktop

Open Claude Desktop and go to Settings → Developer → Edit Config. Add one of these configurations:

#### Option A: Full Semantic Search (Recommended)
```json
{
  "mcpServers": {
    "axiom8-mcp": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "MCP_MODE=stdio",
        "-e", "LOG_LEVEL=error", 
        "-e", "DISABLE_CONSOLE_OUTPUT=true",
        "-e", "ENABLE_SEMANTIC_SEARCH=true",
        "-e", "OPENAI_API_KEY=sk-your-openai-key-here",
        "-e", "COHERE_API_KEY=your-cohere-key-here",
        "-e", "ENABLE_COHERE_RERANKING=true",
        "axiom8-mcp:latest"
      ]
    }
  }
}
```

#### Option B: Basic Mode (No API Keys Needed)
```json
{
  "mcpServers": {
    "axiom8-mcp": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "MCP_MODE=stdio",
        "-e", "LOG_LEVEL=error",
        "-e", "DISABLE_CONSOLE_OUTPUT=true", 
        "-e", "ENABLE_SEMANTIC_SEARCH=false",
        "axiom8-mcp:latest"
      ]
    }
  }
}
```

**Important**: Replace the placeholder API keys with your actual keys from Steps 3.

### Step 5: Configure Claude Code (Alternative)

If you're using Claude Code instead of Claude Desktop, use these commands:

#### Option A: Full Semantic Search (Recommended)
```bash
claude mcp add-json axiom8-mcp '{
  "command": "docker",
  "args": [
    "run", "-i", "--rm",
    "-e", "MCP_MODE=stdio",
    "-e", "LOG_LEVEL=error",
    "-e", "DISABLE_CONSOLE_OUTPUT=true",
    "-e", "ENABLE_SEMANTIC_SEARCH=true",
    "-e", "OPENAI_API_KEY=sk-your-openai-key-here",
    "-e", "COHERE_API_KEY=your-cohere-key-here",
    "-e", "ENABLE_COHERE_RERANKING=true",
    "axiom8-mcp:latest"
  ]
}'
```

#### Option B: Basic Mode (No API Keys Needed)
```bash
claude mcp add-json axiom8-mcp '{
  "command": "docker",
  "args": [
    "run", "-i", "--rm",
    "-e", "MCP_MODE=stdio",
    "-e", "LOG_LEVEL=error",
    "-e", "DISABLE_CONSOLE_OUTPUT=true",
    "-e", "ENABLE_SEMANTIC_SEARCH=false",
    "axiom8-mcp:latest"
  ]
}'
```

### Step 6: Restart Claude Desktop

Close and reopen Claude Desktop completely to load the new configuration.

### Step 7: Test the Installation

Start a new conversation in Claude Desktop and test these commands:

#### Test 1: Basic Functionality
```
Can you list some n8n nodes for me?
```
Expected: Claude shows you a list of n8n nodes.

#### Test 2: Search Functionality  
```
Search for nodes related to "email" using the n8n MCP tools
```
Expected: Claude finds email-related nodes like Gmail, Outlook, etc.

#### Test 3: Node Configuration
```
Show me how to configure the HTTP Request node for a GET request
```
Expected: Claude provides detailed configuration with examples.

#### Test 4: Semantic Search (if enabled)
```
Find nodes that can help me process customer feedback data
```
Expected: Claude finds relevant nodes using AI understanding, not just keywords.

## 🔧 Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_SEMANTIC_SEARCH` | `false` | Enable AI-powered semantic search |
| `OPENAI_API_KEY` | - | Required for semantic search |
| `COHERE_API_KEY` | - | Required for result reranking |
| `ENABLE_COHERE_RERANKING` | `true` | Improve search result quality |
| `LOG_LEVEL` | `error` | Logging level (error, warn, info, debug) |
| `RRF_K` | `60` | Reciprocal Rank Fusion parameter |

### Performance Modes

#### High Performance (Recommended)
```json
"-e", "ENABLE_SEMANTIC_SEARCH=true",
"-e", "ENABLE_COHERE_RERANKING=true",
"-e", "RRF_K=60"
```

#### Free Mode
```json
"-e", "ENABLE_SEMANTIC_SEARCH=false"
```

## ✅ Verification Checklist

- [ ] Docker Desktop is running
- [ ] axiom8-mcp:latest image exists (`docker images | grep axiom8-mcp`)
- [ ] Claude Desktop config is valid JSON
- [ ] API keys are correctly formatted
- [ ] Claude Desktop was restarted after config changes
- [ ] Test queries return n8n node information

## 🔍 Troubleshooting

### Issue: "No such image: axiom8-mcp:latest"
**Solution**: Build the image first:
```bash
docker build -t axiom8-mcp:latest .
```

### Issue: "Invalid JSON in configuration"
**Solution**: Validate your JSON at [jsonlint.com](https://jsonlint.com)

### Issue: "OpenAI API key invalid"
**Solutions**: 
- Check key format (should start with `sk-`)
- Verify you have credits in your OpenAI account
- Check key permissions

### Issue: "MCP connection failed"
**Solutions**:
1. Check Docker is running: `docker ps`
2. Test image manually: `docker run --rm axiom8-mcp:latest`
3. Check Claude Desktop logs in Settings → Developer

### Issue: "Cohere reranking failed"
**Solutions**:
- Verify Cohere API key is correct
- Disable reranking: `"ENABLE_COHERE_RERANKING=false"`

### Issue: "Hybrid search not working"
**Symptoms**: Gets fallback to basic search
**Solutions**:
1. Verify both API keys are working
2. Check OpenAI account has credits
3. Check logs: `"LOG_LEVEL=debug"`



## 🔄 Updating

To update to the latest version:

```bash
# Pull latest changes
git pull origin main

# Rebuild image
docker build -t axiom8-mcp:latest .

# Restart Claude Desktop
```

## 📞 Support

### Getting Help
1. **Check logs**: Set `"LOG_LEVEL=debug"` in your config
2. **Test Docker**: Run `docker run --rm axiom8-mcp:latest`
3. **Verify APIs**: Test your API keys independently
4. **Community**: Open an issue on GitHub

### Common Issues Database
Most issues are configuration-related:
- 90% Docker/Claude Desktop setup
- 8% API key problems  
- 2% Actual bugs

This installation guide should get you from zero to a fully working axiom8-mcp setup in about 15 minutes!