# VibeCast Framework System# 🧮 Modelit MCP Server + 🧠 TribalKnowledge



> Unified graph visualization and management for knowledge, models, and workflows## Overview

**Modelit** is an **MCP (Model Context Protocol) server** that enables both humans and LLM agents to build and inspect **transparent, traceable mathematical models**.

## 🎯 Overview

Unlike spreadsheets, which hide logic behind cell references, Modelit captures every relationship **explicitly** as a set of symbolic equations and dependency links between variables.  

VibeCast Framework System provides a unified way to create, visualize, and manage any type of graph structure. Whether you're modeling financial data, documenting knowledge, or mapping workflows, everything is a **Framework**.It serves as a structured modeling backend for forecasting, analysis, and simulation — starting with **cashflow forecasting** as the primary use case.



## ✨ Features### 🧠 TribalKnowledge Extension



- **Unified Structure** - One system for all graph types**NEW!** Modelit now includes **TribalKnowledge** - a system for creating expert agents with persistent, evolving knowledge graphs.

- **Interactive 2D Viewer** - Modern canvas-based visualization with pan & zoom

- **Multiple Types** - Mathematical, Knowledge, Workflow, and General frameworks🔗 **[Full TribalKnowledge Documentation →](./TRIBAL_KNOWLEDGE.md)**

- **Clean API** - RESTful API for all operations

- **Real-time Updates** - Activity tracking and version control**Key Features:**

- **Beautiful UI** - Modern dashboard with glassmorphism design- 📚 **Distilled Context** - Curated knowledge nodes for efficient agent expertise

- 🔄 **Shared Learning** - Knowledge evolves and is shared across all agents in a codespace

## 🚀 Quick Start- 🌐 **Knowledge Hub** - Public/private marketplace for publishing and forking knowledge bases

- 🎨 **3D Visualization** - Explore knowledge graphs visually with `/visualize` command

### 1. Install Dependencies- 🎯 **Domain Expertise** - Specialized knowledge for different areas (frontend, backend, deployment, etc.)

```bash

npm install---

```

## 🧠 Core Concept

### 2. Setup Database

```bashModelit stores and manipulates models in a **graph-based, declarative format**.

# Set DATABASE_URL in .env file

echo 'DATABASE_URL="postgresql://user:pass@host:port/db"' > .envEach variable has:

- A unique name  

# Push schema to database- A formula (mathematical expression)  

npx prisma db push- A list of dependencies  

```- Optional time-indexed behavior  

- Optional values (for base inputs or evaluated outputs)

### 3. Create Sample Data

```bashExample:

node --import tsx examples/create-frameworks.ts

``````json

{

### 4. Start Server  "name": "EBITDA",

```bash  "formula": "REVENUE - COGS - SG&A",

npm run dev  "dependencies": ["REVENUE", "COGS", "SG&A"]

```}

```

### 5. Open Dashboard

Visit [http://localhost:3000/dashboard](http://localhost:3000/dashboard)Time-dependent variables are also explicit:



## 📊 Framework Types```json

{

### Mathematical  "name": "Cash",

For financial models, calculations, formulas  "formula": "Cash[t-1] + Revenue[t] - Expenses[t]",

- Nodes: parameters, series, scalars  "dependencies": ["Cash[t-1]", "Revenue[t]", "Expenses[t]"]

- Edges: formulas, causality, temporal relationships}

```

### Knowledge  

For documentation, concepts, patterns---

- Nodes: concepts, patterns, gotchas, tools, decisions

- Edges: relationships, dependencies, examples## ⚙️ Server Role



### WorkflowModelit operates as an **MCP server** that exposes a structured model store and evaluation engine.

For processes, pipelines, stages

- Nodes: stages, tasks, gates### Responsibilities

- Edges: sequence, parallel, conditional- Maintain a persistent registry of all variables, formulas, and relationships

- Parse and validate new model definitions

### General- Construct dependency graphs

For any other graph structure- Evaluate formulas in topological order (supporting time-recursive definitions)

- Serve model structure and computed results to connected MCP clients (LLMs or apps)

## 🌐 API Endpoints

### Clients

### List FrameworksClients (human UIs or LLM agents) can:

```bash- Add or modify variables

GET /api/frameworks- Query dependencies

GET /api/frameworks?type=knowledge- Request evaluations

GET /api/frameworks?visibility=public- Store and retrieve scenarios or parameter sets

```

---

### Get Framework

```bash## 🧩 Data Model

GET /api/frameworks/:name

GET /api/frameworks/:name/graph  # Just nodes + edges### Variable

```| Field | Type | Description |

|--------|------|-------------|

### Create Framework| `name` | string | Identifier (e.g., `Revenue`, `EBITDA`, `Cash[t]`) |

```bash| `formula` | string | Expression referencing other variables |

POST /api/frameworks| `dependencies` | string[] | Extracted variable references |

Content-Type: application/json| `type` | enum(`scalar`, `series`, `parameter`) | Distinguishes value type |

| `values` | float[] or null | Optional time series or evaluated data |

{| `metadata` | object | Optional info (units, notes, source) |

  "name": "my-framework",

  "description": "Description here",---

  "type": "knowledge",

  "nodes": [...],## 🧮 Evaluation Logic

  "edges": [...],

  "metadata": {}1. **Dependency Graph Construction**  

}   Parse all variable relationships into a directed acyclic graph (allowing time-based recurrences).

```

2. **Topological Sort**  

## 📁 Project Structure   Determine evaluation order for all non-recursive relationships.



```3. **Iterative Evaluation**  

vibecast/   Evaluate each formula using a safe math parser (`mathjs`, `sympy`, etc.).  

├── src/   For time-dependent variables, iterate over time steps:

│   ├── api/FrameworkAPI.ts         # REST API handlers   ```

│   ├── server/FrameworkServer.ts   # HTTP server   Cash[t] = Cash[t-1] + Revenue[t] - Expenses[t]

│   └── framework-server.ts         # Entry point   ```

├── public/

│   ├── framework-dashboard.html    # Dashboard UI4. **Output Storage**  

│   └── framework-viewer.html       # Graph viewer UI   Store computed values in each variable’s `values` field.

├── examples/

│   └── create-frameworks.ts        # Sample data generator---

├── prisma/

│   └── schema.prisma               # Database schema## 📡 Example Workflow

└── package.json

```### Step 1: Create Variables

```bash

## 🛠️ DevelopmentPOST /variables

{

```bash  "name": "REVENUE",

npm run dev        # Start server  "values": [100, 110, 121]

npm test          # Run tests}

npm run typecheck # Type check

npm run lint      # Lint codePOST /variables

```{

  "name": "COGS",

## 🔗 URLs  "formula": "REVENUE * 0.3",

  "dependencies": ["REVENUE"]

- **Dashboard**: http://localhost:3000/dashboard}

- **API**: http://localhost:3000/api/frameworks

- **View Framework**: http://localhost:3000/framework/{name}POST /variables

- **Health Check**: http://localhost:3000/health{

  "name": "EBITDA",

---  "formula": "REVENUE - COGS - SG&A",

  "dependencies": ["REVENUE", "COGS", "SG&A"]

Built with ❤️ by the VibeCast team}

```

### Step 2: Evaluate
```bash
POST /evaluate
{
  "time_steps": 3
}
```

### Step 3: Inspect Relationships
```bash
GET /graph
```

Returns a dependency map for audit and visualization.

---

## 🧱 Architecture

```
┌───────────────────────────────┐
│          MCP Client           │
│ (LLM agent / UI / Notebook)   │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│        Modelit MCP Server     │
│ ├── Model Registry            │
│ ├── Dependency Graph Builder  │
│ ├── Evaluation Engine         │
│ ├── Scenario Store            │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│   Data Storage (JSON / DB)    │
└───────────────────────────────┘
```

---

## 🔗 Planned Extensions

| Feature | Description |
|----------|--------------|
| **Excel Integration** | Map variable relationships to and from Excel workbooks via Office-JS |
| **Visualization UI** | Show dependency DAGs and time-series plots |
| **Scenario Management** | Save and compare different parameter sets |
| **Probabilistic Modeling** | Support distributions and Monte Carlo simulation |
| **LLM Co-Modeling** | Allow agents to reason about, audit, and propose model edits |

---

## 🧰 Tech Stack (Provisional)
| Component | Technology |
|------------|-------------|
| Language | Python (FastAPI) or Node (Express) |
| Math Parser | `sympy` (Python) or `mathjs` (JS) |
| Storage | JSON or Postgres (JSONB models) |
| Protocol | MCP (Model Context Protocol) |
| Future Integration | Office-JS Add-in for Excel |

---

## 🚀 Quickstart (Prototype)

```bash
git clone https://github.com/modelit/modelit-server
cd modelit-server

# install deps
npm install  # or pip install -r requirements.txt

# run MCP server
npm run start  # or uvicorn main:app --reload
```

Then connect your LLM client or local MCP-compatible interface.

---

## 🧭 Vision
Modelit will evolve into the **“Rosetta Stone” of mathematical models** — a transparent layer uniting:
- Human analysts building in Excel
- LLM agents auditing relationships
- Model graphs that can be simulated, exported, and version-controlled

Every equation explicit.  
Every dependency traceable.  
Every model explainable.
