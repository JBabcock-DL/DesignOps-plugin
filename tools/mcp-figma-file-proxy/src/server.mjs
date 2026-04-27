#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { runUseFigmaFromMcpArgsFile } from '../lib/proxy-tool.mjs';

const mcpServer = new McpServer({
  name: 'designops-figma-proxy',
  version: '1.0.0',
});

mcpServer.registerTool(
  'use_figma_from_mcp_args_file',
  {
    description:
      'Run Figma MCP use_figma with arguments loaded from a JSON file on disk (same shape as assemble-slice --emit-mcp-args). Path must be under FIGMA_MCP_READ_ROOTS / FIGMA_MCP_WORKSPACE_ROOT. Preflight: scripts/check-use-figma-mcp-args.mjs',
    inputSchema: {
      mcpArgsPath: z
        .string()
        .describe('Path to the full use_figma arguments JSON file'),
    },
  },
  async ({ mcpArgsPath }) => runUseFigmaFromMcpArgsFile({ mcpArgsPath })
);

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
