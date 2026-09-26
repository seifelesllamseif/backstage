import { describe, expect, it } from 'vitest'
import { registerTools } from '@/plugins/mcp/tools'

// registerTools only calls server.registerTool, so a recorder is enough to
// inspect the catalogue a client would see. Handlers are never invoked here -
// this guards what the model is told, which is the part that kept regressing:
// tools that exist in the UI but not over MCP, and tools with a description
// too thin for a model to fill the arguments from.
type Registered = { name: string; description: string; hasSchema: boolean }

function catalogue(): Registered[] {
  const tools: Registered[] = []
  const server = {
    registerTool: (
      name: string,
      config: { description?: string; inputSchema?: unknown }
    ) => {
      tools.push({
        name,
        description: config.description ?? '',
        hasSchema: config.inputSchema != null
      })
    }
  }
  registerTools(server as never)
  return tools
}

describe('mcp tool catalogue', () => {
  const tools = catalogue()

  it('can manage projects and links, not just tasks', () => {
    const names = tools.map((t) => t.name)
    expect(names).toContain('manage_project')
    expect(names).toContain('manage_links')
  })

  it('describes every tool and declares every schema', () => {
    for (const tool of tools) {
      expect(tool.hasSchema, `${tool.name} has no inputSchema`).toBe(true)
      expect(
        tool.description.length,
        `${tool.name} needs a description a model can act on`
      ).toBeGreaterThan(40)
    }
  })

  it('names tools in snake_case so they read as one family', () => {
    for (const tool of tools) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/)
    }
  })
})
