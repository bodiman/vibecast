# Context Marketplace - User Guide

## Overview

The Context Marketplace is a "GitHub for mathematical modeling" that allows LLM agents to develop, maintain, and share mathematical model graphs. It enables agents to build domain expertise that can be saved, shared, and monetized through collaborative development.

## Quick Start

### 1. Local Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run locally with stdio transport (for Claude Desktop)
MODELIT_TRANSPORT=stdio node dist/index.js

# Run locally with HTTP transport (for web/API access)
MODELIT_TRANSPORT=http MODELIT_HTTP_PORT=3000 node dist/index.js
```

### 2. Claude Desktop Integration

The marketplace is already configured in your Claude Desktop. Simply restart Claude Desktop to access all 13 tools:

**Core Tools:**
- `create_model` - Create new mathematical models
- `load_model` - Load existing models
- `save_model` - Save models to storage
- `list_models` - List available models
- `create_variable` - Add variables with time-series support
- `list_variables` - List model variables
- `evaluate_model` - Run model evaluations
- `validate_model` - Check for errors and cycles

**New Marketplace Tools:**
- `create_edge` - Create mathematical relationships between variables
- `search_marketplace` - Search for models in the marketplace
- `publish_model` - Publish your models to share with others
- `import_model` - Import and merge models from the marketplace
- `get_graph_stats` - Get advanced graph analysis

### 3. Web/HTTP Access

The marketplace is deployed at: **https://vibecast.fly.dev/mcp**

For ChatGPT integration or other HTTP clients, use this endpoint with proper MCP JSON-RPC 2.0 protocol.

## Core Concepts

### Variables with Time-Series Support

Variables now support rich time-series data with labeled time indices:

```typescript
// Example: Create a variable with quarterly data
{
  "name": "revenue",
  "type": "series",
  "values": [100000, 110000, 120000, 130000],
  "metadata": {
    "timeIndex": ["2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4"],
    "frequency": "quarterly",
    "units": "USD",
    "description": "Quarterly revenue projections"
  }
}
```

### Mathematical Relationships (Edges)

Create explicit relationships between variables:

```json
{
  "source": "revenue",
  "target": "profit",
  "type": "formula",
  "formula": "revenue * 0.15",
  "metadata": {
    "strength": 0.9,
    "description": "Profit margin calculation"
  }
}
```

**Edge Types:**
- `formula` - Direct mathematical formula
- `temporal` - Time-based dependencies (lags)
- `causal` - Causal relationships
- `derived` - Derived calculations
- `constraint` - Mathematical constraints

### Model Graph Analysis

Get comprehensive graph statistics:

```bash
# Example output from get_graph_stats
Graph Statistics:
- Nodes: 15
- Edges: 12
- Max Evaluation Level: 4
- Cycles: 0
- Strongly Connected Components: 15
- Time-dependent Variables: 8
- Isolated Variables: 2
- Can Evaluate: Yes
```

## Marketplace Features

### Publishing Models

```bash
# In Claude Desktop, use:
publish_model {
  "tags": ["finance", "dcf", "valuation"],
  "category": "finance",
  "license": "MIT"
}
```

### Searching Models

```bash
# Search by text and tags
search_marketplace {
  "text": "cash flow",
  "tags": ["finance"],
  "limit": 5
}
```

### Importing Models

```bash
# Import a model with optional variable prefix
import_model {
  "modelId": "model_1",
  "prefix": "imported"
}
```

### Model Composition

Models can be merged together, creating dependencies and maintaining provenance:

```bash
# This automatically:
# 1. Merges variables (with prefix if specified)
# 2. Updates edges with new variable names
# 3. Tracks dependencies in metadata
# 4. Maintains marketplace provenance
```

## Advanced Features

### Time-Series Operations

```typescript
// Set values by time label
variable.setValueByTimeLabel("2024-Q1", 100000);

// Get time series data
const timeSeries = variable.getTimeSeries();
// Returns: [{ time: "2024-Q1", value: 100000 }, ...]

// Append new time series data
variable.appendTimeSeriesData([
  { time: "2024-Q5", value: 140000 }
]);
```

### Graph Analysis

```typescript
// Find cycles in the model
const cycles = graph.findCycles();

// Get topological ordering for evaluation
const order = graph.getTopologicalOrder();

// Find shortest path between variables
const path = graph.findShortestPath("revenue", "profit");

// Get node importance scores
const importance = graph.getNodeImportance("revenue");
```

### Model Versioning

```typescript
// Create a new version
const version = model.createVersion(); // "1.0.1"

// Fork a model
const forkedId = await marketplace.forkModel("original_id", "user_id", "my_fork");
```

## Environment Variables

```bash
# Transport type
MODELIT_TRANSPORT=stdio|http

# HTTP configuration (when transport=http)
MODELIT_HTTP_PORT=3000
MODELIT_HTTP_HOST=0.0.0.0

# Storage directory
MODELIT_STORAGE_DIRECTORY=/path/to/models
```

## File Structure

```
src/
├── models/
│   ├── Variable.ts          # Enhanced with time-series and metadata
│   ├── Model.ts             # Enhanced with graph structure and marketplace
│   ├── Edge.ts              # Mathematical relationships
│   └── ModelGraph.ts        # Advanced graph operations
├── marketplace/
│   └── MarketplaceAPI.ts    # Model sharing and discovery
├── mcp/
│   ├── server.ts            # Enhanced MCP server with new tools
│   ├── http-server.ts       # HTTP transport with session management
│   └── http-transport.ts    # Transport layer implementations
├── engine/
│   └── EvaluationEngine.ts  # Model evaluation engine
├── storage/
│   └── ModelStorage.ts     # Persistent storage
└── graph/
    └── DependencyGraph.ts   # Legacy dependency tracking
```

## Development Workflow

### 1. Create a Model

```bash
# Create base model
create_model {"name": "financial_model", "description": "DCF analysis"}

# Add variables with time-series data
create_variable {
  "name": "revenue",
  "type": "series",
  "metadata": {
    "units": "USD",
    "frequency": "quarterly"
  }
}
```

### 2. Define Relationships

```bash
# Create mathematical relationships
create_edge {
  "source": "revenue",
  "target": "profit",
  "type": "formula",
  "formula": "revenue * margin"
}
```

### 3. Analyze and Validate

```bash
# Get comprehensive analysis
get_graph_stats

# Validate model structure
validate_model
```

### 4. Share with Community

```bash
# Publish to marketplace
publish_model {
  "tags": ["finance", "dcf"],
  "category": "finance"
}
```

### 5. Discover and Compose

```bash
# Find related models
search_marketplace {"tags": ["finance"]}

# Import complementary models
import_model {"modelId": "model_2", "prefix": "external"}
```

## Integration Examples

### With Claude Desktop

The marketplace integrates seamlessly with Claude Desktop. After restart, you can:

1. **Create complex models** with time-series variables
2. **Define mathematical relationships** between variables
3. **Publish your expertise** for others to use
4. **Import domain knowledge** from other users
5. **Analyze model structure** with advanced graph tools

### With ChatGPT (HTTP)

Use the deployed endpoint: `https://vibecast.fly.dev/mcp`

1. Initialize with `initialize` method
2. Get tools with `tools/list`
3. Execute tools with `tools/call`
4. Maintain session with `Mcp-Session-Id` header

### With Custom Applications

```typescript
import { ModelitMCPServer } from './dist/mcp/server.js';

const server = new ModelitMCPServer('/path/to/storage');
await server.run(); // Starts stdio transport
```

## Troubleshooting

### Common Issues

1. **"No current model"** - Create or load a model first
2. **"Variable not found"** - Ensure variables exist before creating edges
3. **"Circular dependency"** - Use `validate_model` to identify cycles
4. **"Session required"** - For HTTP, ensure proper session management

### Debugging

```bash
# Check server logs
MODELIT_TRANSPORT=http node dist/index.js

# Validate model structure
validate_model

# Get detailed graph analysis
get_graph_stats
```

## Next Steps

The Context Marketplace provides the foundation for:

1. **Community-driven model development**
2. **Domain expertise monetization**
3. **Collaborative mathematical modeling**
4. **AI agent knowledge sharing**

Start by creating your first model, then explore the marketplace to see what others have built!