/**
 * axiom8-mcp - Enhanced n8n Model Context Protocol Server with Semantic Search
 * Copyright (c) 2024 Axioma (https://axioma.ai)
 * Enhanced fork of original work by Romuald Czlonkowski
 * Licensed under the MIT License
 */

// Engine exports for service integration
export { N8NMCPEngine, EngineHealth, EngineOptions } from './mcp-engine';
export { SingleSessionHTTPServer } from './http-server-single-session';
export { ConsoleManager } from './utils/console-manager';
export { N8NDocumentationMCPServer } from './mcp/server';

// Default export for convenience
import N8NMCPEngine from './mcp-engine';
export default N8NMCPEngine;

// Legacy CLI functionality - moved to ./mcp/index.ts
// This file now serves as the main entry point for library usage