/**
 * Development / test use when FIGMA_MCP_TEST_MOCK=1.
 */
export async function createMockFigmaClient() {
  return {
    callTool: async ({ name, arguments: args }) => {
      if (name !== 'use_figma') {
        throw new Error('unexpected tool ' + name);
      }
      return {
        content: [
          { type: 'text', text: `mock-ok fileKey=${args && args.fileKey}` },
        ],
      };
    },
  };
}
