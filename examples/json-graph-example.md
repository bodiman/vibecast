# JSON Graph Tools Example

This example demonstrates how to use the new JSON graph tools in the MCP server to load and update graph structures.

## Available Tools

### 1. `load_graph_json`
Loads the complete graph structure in JSON format for LLM processing.

**Parameters:**
- `modelName` (optional): Model name to load (uses current model if not provided)
- `includeValues` (optional): Include variable values in output (default: true)
- `includeMetadata` (optional): Include metadata in output (default: true)

**Example:**
```json
{
  "modelName": "my_model",
  "includeValues": true,
  "includeMetadata": true
}
```

### 2. `update_graph_json`
Updates graph structure from JSON data provided by LLM.

**Parameters:**
- `graphData` (required): Complete graph structure with variables and edges
- `modelName` (optional): Model name to update (uses current model if not provided)
- `validateOnly` (optional): Only validate without applying changes (default: false)

**Example:**
```json
{
  "graphData": {
    "model": {
      "name": "financial_model",
      "description": "A simple financial model",
      "metadata": {
        "version": "1.0.0",
        "author": "user",
        "tags": ["finance", "forecasting"]
      }
    },
    "variables": [
      {
        "name": "revenue",
        "type": "series",
        "formula": "units * price",
        "dependencies": ["units", "price"],
        "metadata": {
          "description": "Total revenue",
          "units": "USD"
        }
      },
      {
        "name": "units",
        "type": "parameter",
        "values": [100, 110, 120, 130],
        "metadata": {
          "description": "Units sold per quarter",
          "units": "units",
          "timeIndex": ["2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4"]
        }
      },
      {
        "name": "price",
        "type": "parameter",
        "values": [50, 52, 55, 58],
        "metadata": {
          "description": "Price per unit per quarter",
          "units": "USD",
          "timeIndex": ["2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4"]
        }
      }
    ],
    "edges": [
      {
        "id": "units-to-revenue",
        "source": "units",
        "target": "revenue",
        "type": "dependency",
        "metadata": {
          "description": "Units contribute to revenue",
          "strength": 1.0
        }
      },
      {
        "id": "price-to-revenue",
        "source": "price",
        "target": "revenue",
        "type": "dependency",
        "metadata": {
          "description": "Price contributes to revenue",
          "strength": 1.0
        }
      }
    ]
  },
  "modelName": "financial_model",
  "validateOnly": false
}
```

### 3. `validate_graph_json`
Validates graph JSON data structure and dependencies.

**Parameters:**
- `graphData` (required): Graph structure to validate

**Example:**
```json
{
  "graphData": {
    "variables": [...],
    "edges": [...]
  }
}
```

## JSON Structure

### Variables
Each variable must have:
- `name` (string): Variable name
- `type` (string): One of 'scalar', 'series', 'parameter'
- `formula` (string, optional): Mathematical formula
- `dependencies` (array, optional): Array of variable names this depends on
- `values` (array, optional): Array of numeric values
- `metadata` (object, optional): Additional metadata

### Edges
Each edge must have:
- `id` (string): Unique edge identifier
- `source` (string): Source variable name
- `target` (string): Target variable name
- `type` (string): One of 'dependency', 'temporal', 'causal', 'derived', 'constraint'
- `metadata` (object, optional): Additional metadata

## Validation Rules

1. All variable names must be unique
2. All edge IDs must be unique
3. Edge source and target variables must exist in the variables array
4. Variable dependencies must reference existing variables
5. Variable types must be valid enum values
6. Edge types must be valid enum values

## Usage Workflow

1. **Load existing graph**: Use `load_graph_json` to get current model structure
2. **Modify JSON**: Update the JSON structure as needed
3. **Validate**: Use `validate_graph_json` to check for errors
4. **Update**: Use `update_graph_json` to apply changes to the model

## Error Handling

The tools provide comprehensive error messages for:
- Missing required fields
- Invalid data types
- Circular dependencies
- Missing variable references
- Invalid enum values

All validation errors are returned as a list of descriptive error messages.
