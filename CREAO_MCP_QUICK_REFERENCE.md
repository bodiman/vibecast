# Creao MCP Quick Reference for AI Models

This is a quick reference for AI assistants using the Creao MCP Server to interact with the VibeCast Framework System.

## 🎯 What You Can Do

You have access to a graph framework system where you can:
- Create and manage frameworks (graphs with nodes and edges)
- Query existing frameworks
- Add/modify nodes and edges
- Analyze graph structures
- Get statistics

## 📊 Framework Types

- **mathematical**: Financial models, calculations, formulas
- **knowledge**: Documentation, concepts, patterns, decisions
- **workflow**: Processes, pipelines, stages, tasks
- **general**: Any other graph structure

## 🛠️ Available Tools

### `list_frameworks`
Get all frameworks, optionally filtered.
```json
{ "type": "mathematical", "visibility": "public" }
```

### `get_framework`
Get full details of a specific framework.
```json
{ "name": "financial-model" }
```

### `create_framework`
Create a new framework.
```json
{
  "name": "my-framework",
  "description": "Description here",
  "type": "knowledge",
  "nodes": [
    {
      "id": "node1",
      "name": "Node Name",
      "type": "concept",
      "metadata": { "key": "value" },
      "position": { "x": 0, "y": 0, "z": 0 }
    }
  ],
  "edges": [
    {
      "id": "edge1",
      "source": "node1",
      "target": "node2",
      "metadata": { "relationship": "depends-on" }
    }
  ]
}
```

### `add_node`
Add a node to existing framework.
```json
{
  "frameworkName": "my-framework",
  "node": {
    "id": "new-node",
    "name": "New Node",
    "type": "concept"
  }
}
```

### `add_edge`
Add an edge to existing framework.
```json
{
  "frameworkName": "my-framework",
  "edge": {
    "id": "new-edge",
    "source": "node1",
    "target": "new-node"
  }
}
```

### `query_graph`
Search/filter a framework's nodes.
```json
{
  "frameworkName": "my-framework",
  "query": {
    "nodeType": "concept",
    "searchTerm": "api"
  }
}
```

### `get_stats`
Get framework statistics.
```json
{}
```

## 💡 Example Workflows

### Creating a Knowledge Framework
```
User: "Create a knowledge framework about React best practices"

1. Use create_framework with type="knowledge"
2. Create nodes for concepts (Hooks, Context, Components, etc.)
3. Create edges showing relationships
4. Add metadata to nodes with details/examples
```

### Analyzing an Existing Framework
```
User: "Analyze the financial-model framework"

1. Use get_framework to get all data
2. Analyze nodes and edges
3. Summarize structure and relationships
4. Identify key nodes (high connectivity)
```

### Extending a Framework
```
User: "Add error handling to the dev-workflow"

1. Use get_framework to see current structure
2. Use add_node to create "Error Handling" node
3. Use add_edge to connect it to relevant stages
```

## 🎨 Node Position Guidelines

Positions use a 3D coordinate system:
- **x**: horizontal (left/right)
- **y**: vertical (up/down)
- **z**: depth (optional, for 3D views)

Typical spacing: 2-4 units between nodes

## 📝 Metadata Best Practices

### Mathematical Frameworks
```json
{
  "formula": "Revenue * 0.3",
  "unit": "USD",
  "values": [100, 110, 121]
}
```

### Knowledge Frameworks
```json
{
  "description": "Detailed explanation",
  "examples": ["example1", "example2"],
  "references": ["https://..."],
  "tags": ["react", "hooks"]
}
```

### Workflow Frameworks
```json
{
  "duration": "2 days",
  "owner": "team-name",
  "status": "active",
  "prerequisites": ["step1", "step2"]
}
```

## 🔍 Common Patterns

### Creating a Process Workflow
1. Create "start" node
2. Create stage nodes (dev, test, deploy)
3. Create "end" node
4. Connect with edges showing sequence
5. Add parallel branches where needed

### Building a Dependency Graph
1. Create nodes for components/modules
2. Use edges to show dependencies
3. Set edge metadata with dependency type
4. Query to find cycles or bottlenecks

### Documenting Architecture
1. Create nodes for systems/services
2. Add detailed metadata with responsibilities
3. Use edges for communication/data flow
4. Include external dependencies

## ⚠️ Important Notes

- Node IDs must be unique within a framework
- Edge source/target must reference existing node IDs
- Framework names must be unique
- Consider using kebab-case for names (e.g., "my-framework")
- Position values should be reasonable (-100 to 100 typical range)

## 🚀 Pro Tips

1. **Start Simple**: Create basic structure first, then add details
2. **Use Descriptive IDs**: Use meaningful node/edge IDs (not just "node1")
3. **Leverage Metadata**: Store rich information in metadata fields
4. **Query Before Adding**: Check existing structure before modifications
5. **Use Consistent Types**: Establish type conventions per framework type

## 📖 Resources

- Full Documentation: `CREAO_MCP.md`
- Framework System README: `README.md`
- View Frameworks: http://localhost:3000/dashboard
