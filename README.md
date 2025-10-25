# 🧮 Modelit MCP Server

## Overview
**Modelit** is an **MCP (Model Context Protocol) server** that enables both humans and LLM agents to build and inspect **transparent, traceable mathematical models**.

Unlike spreadsheets, which hide logic behind cell references, Modelit captures every relationship **explicitly** as a set of symbolic equations and dependency links between variables.  
It serves as a structured modeling backend for forecasting, analysis, and simulation — starting with **cashflow forecasting** as the primary use case.

---

## 🧠 Core Concept

Modelit stores and manipulates models in a **graph-based, declarative format**.

Each variable has:
- A unique name  
- A formula (mathematical expression)  
- A list of dependencies  
- Optional time-indexed behavior  
- Optional values (for base inputs or evaluated outputs)

Example:

```json
{
  "name": "EBITDA",
  "formula": "REVENUE - COGS - SG&A",
  "dependencies": ["REVENUE", "COGS", "SG&A"]
}
```

Time-dependent variables are also explicit:

```json
{
  "name": "Cash",
  "formula": "Cash[t-1] + Revenue[t] - Expenses[t]",
  "dependencies": ["Cash[t-1]", "Revenue[t]", "Expenses[t]"]
}
```

---

## ⚙️ Server Role

Modelit operates as an **MCP server** that exposes a structured model store and evaluation engine.

### Responsibilities
- Maintain a persistent registry of all variables, formulas, and relationships
- Parse and validate new model definitions
- Construct dependency graphs
- Evaluate formulas in topological order (supporting time-recursive definitions)
- Serve model structure and computed results to connected MCP clients (LLMs or apps)

### Clients
Clients (human UIs or LLM agents) can:
- Add or modify variables
- Query dependencies
- Request evaluations
- Store and retrieve scenarios or parameter sets

---

## 🧩 Data Model

### Variable
| Field | Type | Description |
|--------|------|-------------|
| `name` | string | Identifier (e.g., `Revenue`, `EBITDA`, `Cash[t]`) |
| `formula` | string | Expression referencing other variables |
| `dependencies` | string[] | Extracted variable references |
| `type` | enum(`scalar`, `series`, `parameter`) | Distinguishes value type |
| `values` | float[] or null | Optional time series or evaluated data |
| `metadata` | object | Optional info (units, notes, source) |

---

## 🧮 Evaluation Logic

1. **Dependency Graph Construction**  
   Parse all variable relationships into a directed acyclic graph (allowing time-based recurrences).

2. **Topological Sort**  
   Determine evaluation order for all non-recursive relationships.

3. **Iterative Evaluation**  
   Evaluate each formula using a safe math parser (`mathjs`, `sympy`, etc.).  
   For time-dependent variables, iterate over time steps:
   ```
   Cash[t] = Cash[t-1] + Revenue[t] - Expenses[t]
   ```

4. **Output Storage**  
   Store computed values in each variable’s `values` field.

---

## 📡 Example Workflow

### Step 1: Create Variables
```bash
POST /variables
{
  "name": "REVENUE",
  "values": [100, 110, 121]
}

POST /variables
{
  "name": "COGS",
  "formula": "REVENUE * 0.3",
  "dependencies": ["REVENUE"]
}

POST /variables
{
  "name": "EBITDA",
  "formula": "REVENUE - COGS - SG&A",
  "dependencies": ["REVENUE", "COGS", "SG&A"]
}
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
