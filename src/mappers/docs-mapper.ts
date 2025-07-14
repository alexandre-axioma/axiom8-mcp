import { promises as fs } from 'fs';
import path from 'path';

export class DocsMapper {
  private docsPath = path.join(process.cwd(), '..', '..', 'n8n-docs');
  
  // Known documentation mapping fixes
  private readonly KNOWN_FIXES: Record<string, string> = {
    'httpRequest': 'httprequest',
    'code': 'code',
    'webhook': 'webhook',
    'respondToWebhook': 'respondtowebhook',
    // OpenAI nodes - map nodes-base to langchain docs
    'openAi': 'n8n-nodes-langchain.openai',
    'nodes-base.openAi': 'n8n-nodes-langchain.openai',
    // With package prefix
    'n8n-nodes-base.httpRequest': 'httprequest',
    'n8n-nodes-base.code': 'code',
    'n8n-nodes-base.webhook': 'webhook',
    'n8n-nodes-base.respondToWebhook': 'respondtowebhook'
  };

  async fetchDocumentation(nodeType: string): Promise<string | null> {
    // Apply known fixes first
    const fixedType = this.KNOWN_FIXES[nodeType] || nodeType;
    
    // Extract node name - for langchain nodes, keep the full type
    let nodeName: string;
    if (fixedType.startsWith('nodes-langchain.')) {
      nodeName = 'n8n-' + fixedType; // Convert "nodes-langchain.agent" to "n8n-nodes-langchain.agent"
    } else if (fixedType.startsWith('n8n-nodes-langchain.')) {
      nodeName = fixedType; // Keep full type like "n8n-nodes-langchain.agent"
    } else {
      nodeName = fixedType.split('.').pop()?.toLowerCase() || '';
    }
    
    if (!nodeName) {
      console.log(`⚠️  Could not extract node name from: ${nodeType}`);
      return null;
    }
    
    console.log(`📄 Looking for docs for: ${nodeType} -> ${nodeName}`);
    
    // Handle langchain nodes differently
    let possiblePaths: string[];
    
    if (nodeName.startsWith('n8n-nodes-langchain.')) {
      // For langchain nodes, use the exact type name
      possiblePaths = [
        // Cluster nodes (most langchain nodes are here)
        `docs/integrations/builtin/cluster-nodes/root-nodes/${nodeName}/index.md`,
        `docs/integrations/builtin/cluster-nodes/sub-nodes/${nodeName}/index.md`,
        `docs/integrations/builtin/cluster-nodes/root-nodes/${nodeName}.md`,
        `docs/integrations/builtin/cluster-nodes/sub-nodes/${nodeName}.md`,
        // App nodes (some langchain nodes like OpenAI are here)
        `docs/integrations/builtin/app-nodes/${nodeName}/index.md`,
        `docs/integrations/builtin/app-nodes/${nodeName}.md`
      ];
    } else {
      // For nodes-base nodes, use traditional paths
      possiblePaths = [
        // Direct file paths
        `docs/integrations/builtin/core-nodes/n8n-nodes-base.${nodeName}.md`,
        `docs/integrations/builtin/app-nodes/n8n-nodes-base.${nodeName}.md`,
        `docs/integrations/builtin/trigger-nodes/n8n-nodes-base.${nodeName}.md`,
        // Directory with index.md
        `docs/integrations/builtin/core-nodes/n8n-nodes-base.${nodeName}/index.md`,
        `docs/integrations/builtin/app-nodes/n8n-nodes-base.${nodeName}/index.md`,
        `docs/integrations/builtin/trigger-nodes/n8n-nodes-base.${nodeName}/index.md`
      ];
    }
    
    // Try each path
    for (const relativePath of possiblePaths) {
      try {
        const fullPath = path.join(this.docsPath, relativePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        console.log(`  ✓ Found docs at: ${relativePath}`);
        return content;
      } catch (error) {
        // File doesn't exist, try next
        continue;
      }
    }
    
    console.log(`  ✗ No docs found for ${nodeName}`);
    return null;
  }
}