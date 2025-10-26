# Creao MCP Server

## 🤖 Overview

The **Creao MCP Server** exposes the VibeCast Framework System to AI models through the Model Context Protocol (MCP). This allows AI assistants like Claude, ChatGPT, and other LLM-based tools to programmatically interact with your graph frameworks.

## 🎯 Purpose

AI models can use this MCP server to:
- Browse and search existing frameworks
- Create new frameworks with nodes and edges
- Query graph structures
- Add/modify nodes and edges
- Get statistics about your framework system
- Access frameworks as resources

## 🚀 Quick Start

### 1. Start the MCP Server

```bash
npm run mcp
```

### 2. Test with MCP Inspector

```bash
npm run mcp:inspect
```

This opens a web interface where you can test all MCP tools interactively.

### 3. Configure in Claude Desktop

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "vibecast": {
      "command": "node",
      "args": [
        "--import",
        "tsx/esm",
        "/absolute/path/to/vibecast/src/mcp/creao-server.ts"
      ],
      "env": {
        "DATABASE_URL": "your_postgres_connection_string"
      }
    }
  }
}
```

## 🛠️ Available Tools

### 1. `list_frameworks`
List all frameworks with optional filtering.

**Parameters:**
- `type` (optional): Filter by type (mathematical, knowledge, workflow, general)
- `visibility` (optional): Filter by visibility (public, private)

**Example:**
```json
{
  "type": "mathematical",
  "visibility": "public"
}
```

### 2. `get_framework`
Get detailed information about a specific framework.

**Parameters:**
- `name` (required): Framework name/ID

**Example:**
```json
{
  "name": "financial-model"
}
```

### 3. `create_framework`
Create a new framework with nodes and edges.

**Parameters:**
- `name` (required): Unique name
- `description` (required): Framework description
- `type` (required): Framework type
- `nodes` (required): Array of nodes
- `edges` (required): Array of edges
- `visibility` (optional): public/private

**Example:**
```json
{
  "name": "my-workflow",
  "description": "A sample workflow",
  "type": "workflow",
  "nodes": [
    {
      "id": "start",
      "name": "Start",
      "type": "stage",
      "position": { "x": 0, "y": 0, "z": 0 }
    },
    {
      "id": "process",
      "name": "Process",
      "type": "stage",
      "position": { "x": 2, "y": 0, "z": 0 }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "start",
      "target": "process"
    }
  ],
  "visibility": "private"
}
```

### 4. `update_framework`
Update an existing framework.

**Parameters:**
- `name` (required): Framework name
- `description` (optional): New description
- `nodes` (optional): Updated nodes array
- `edges` (optional): Updated edges array
- `metadata` (optional): Additional metadata

### 5. `delete_framework`
Delete a framework.

**Parameters:**
- `name` (required): Framework name

### 6. `add_node`
Add a new node to an existing framework.

**Parameters:**
- `frameworkName` (required): Target framework
- `node` (required): Node object with id, name, type

**Example:**
```json
{
  "frameworkName": "financial-model",
  "node": {
    "id": "new-var",
    "name": "New Variable",
    "type": "scalar",
    "metadata": { "formula": "Revenue * 0.1" },
    "position": { "x": 5, "y": 2, "z": 0 }
  }
}
```

### 7. `add_edge`
Add a new edge to an existing framework.

**Parameters:**
- `frameworkName` (required): Target framework
- `edge` (required): Edge object with id, source, target

**Example:**
```json
{
  "frameworkName": "financial-model",
  "edge": {
    "id": "e-new",
    "source": "revenue",
    "target": "new-var",
    "metadata": { "relationship": "dependency" }
  }
}
```

### 8. `query_graph`
Query a framework graph with filters.

**Parameters:**
- `frameworkName` (required): Target framework
- `query` (optional): Query filters
  - `nodeType`: Filter by node type
  - `searchTerm`: Search in names/metadata

**Example:**
```json
{
  "frameworkName": "financial-model",
  "query": {
    "nodeType": "series",
    "searchTerm": "revenue"
  }
}
```

### 9. `get_stats`
Get statistics about all frameworks.

**Returns:**
- Total framework count
- Count by type
- Count by visibility

## 📚 Resources

The MCP server also exposes frameworks as **resources** that can be read directly:

- URI format: `framework://framework-name`
- MIME type: `application/json`

AI models can list all available framework resources and read their complete JSON representations.

## 🔌 Integration Examples

### Example 1: Ask Claude to Create a Framework

> "Create a new knowledge framework called 'frontend-patterns' with nodes for React, Vue, and Angular, connected with 'alternative' relationships."

Claude will use the `create_framework` tool to build this.

### Example 2: Query Existing Data

> "Show me all mathematical frameworks and summarize their nodes."

Claude will use `list_frameworks` with type filter, then `get_framework` for details.

### Example 3: Extend a Framework

> "Add a new node called 'Testing' to the dev-workflow framework and connect it to the 'Development' stage."

Claude will use `add_node` and `add_edge` tools.

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│         AI Model (Claude)           │
│  - Reads tools/resources            │
│  - Makes function calls             │
└──────────────┬──────────────────────┘
               │ MCP Protocol
               │ (stdio transport)
┌──────────────┴──────────────────────┐
│      Creao MCP Server               │
│  - Tool handlers                    │
│  - Resource handlers                │
│  - Prisma client                    │
└──────────────┬──────────────────────┘
               │ Database queries
┌──────────────┴──────────────────────┐
│      PostgreSQL Database            │
│  - Framework table                  │
│  - Nodes & edges (JSONB)            │
└─────────────────────────────────────┘
```

## 🧪 Testing

### Test with MCP Inspector

```bash
npm run mcp:inspect
```

This opens a browser interface where you can:
1. See all available tools
2. Test tool calls with different parameters
3. View responses in real-time
4. Browse available resources

### Test Manually

1. Start the MCP server:
```bash
npm run mcp
```

2. Send a tool request via stdin (JSON-RPC format):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

## 🔒 Security Considerations

- The MCP server has **full access** to your framework database
- Only expose it to trusted AI models/clients
- Consider adding authentication for production use
- Review all AI-generated modifications before committing

## 📊 Use Cases

### 1. AI-Assisted Framework Creation
Let AI models help you design complex frameworks by describing them in natural language.

### 2. Automated Documentation
AI can analyze frameworks and generate comprehensive documentation.

### 3. Graph Analysis
AI models can query and analyze graph structures, finding patterns and insights.

### 4. Knowledge Base Building
Collaboratively build knowledge frameworks with AI assistance.

### 5. Model Validation
AI can validate mathematical models by checking dependencies and formulas.

## 🐛 Troubleshooting

### Server won't start
- Check that `DATABASE_URL` is set in `.env`
- Ensure PostgreSQL is running
- Verify `@modelcontextprotocol/sdk` is installed

### AI model can't connect
- Verify the absolute path in MCP config
- Check that `tsx` is installed globally or use full path
- Review logs in the AI client

### Tools not showing up
- Restart the AI client after config changes
- Check MCP server logs for errors
- Verify JSON-RPC communication

## 🚀 Next Steps

1. **Add Authentication**: Implement API keys or OAuth
2. **Add Permissions**: Role-based access control for frameworks
3. **Add Webhooks**: Notify external systems of changes
4. **Add Validation**: Schema validation for nodes/edges
5. **Add Versioning**: Track framework changes over time

## 📖 Related Documentation

- [VibeCast Framework System README](../README.md)
- [Model Context Protocol Spec](https://modelcontextprotocol.io)
- [Prisma Documentation](https://www.prisma.io/docs)
