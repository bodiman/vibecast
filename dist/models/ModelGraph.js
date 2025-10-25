import { Model } from './Model.js';
export class ModelGraph {
    constructor(model) {
        this.nodes = new Map();
        this.adjacencyList = new Map();
        this.reverseAdjacencyList = new Map();
        this.model = model;
        this.buildGraph();
    }
    buildGraph() {
        this.nodes.clear();
        this.adjacencyList.clear();
        this.reverseAdjacencyList.clear();
        // Create nodes
        for (const variable of this.model.listVariables()) {
            this.nodes.set(variable.name, {
                id: variable.name,
                variable,
                level: -1,
                visited: false,
                processing: false
            });
            this.adjacencyList.set(variable.name, new Set());
            this.reverseAdjacencyList.set(variable.name, new Set());
        }
        // Create adjacency lists from edges
        for (const edge of this.model.listEdges()) {
            this.adjacencyList.get(edge.source)?.add(edge.target);
            this.reverseAdjacencyList.get(edge.target)?.add(edge.source);
        }
        // Also consider formula dependencies for backward compatibility
        for (const variable of this.model.listVariables()) {
            for (const dep of variable.dependencies) {
                const baseVarName = this.extractBaseVariableName(dep);
                if (this.nodes.has(baseVarName)) {
                    this.adjacencyList.get(baseVarName)?.add(variable.name);
                    this.reverseAdjacencyList.get(variable.name)?.add(baseVarName);
                }
            }
        }
    }
    extractBaseVariableName(depName) {
        // Extract base variable name from time references like VAR[t-1] -> VAR
        const timeRefMatch = depName.match(/^([A-Za-z_][A-Za-z0-9_]*)\[t[+-]?\d*\]$/);
        if (timeRefMatch) {
            return timeRefMatch[1];
        }
        return depName;
    }
    // Graph analysis methods
    findCycles() {
        const cycles = [];
        const visited = new Set();
        const recursionStack = new Set();
        const path = [];
        const dfs = (nodeId) => {
            if (recursionStack.has(nodeId)) {
                // Found a cycle, extract it from the path
                const cycleStart = path.indexOf(nodeId);
                if (cycleStart >= 0) {
                    cycles.push([...path.slice(cycleStart), nodeId]);
                }
                return true;
            }
            if (visited.has(nodeId)) {
                return false;
            }
            visited.add(nodeId);
            recursionStack.add(nodeId);
            path.push(nodeId);
            const neighbors = this.adjacencyList.get(nodeId) || new Set();
            for (const neighbor of neighbors) {
                if (dfs(neighbor)) {
                    return true;
                }
            }
            recursionStack.delete(nodeId);
            path.pop();
            return false;
        };
        for (const nodeId of this.nodes.keys()) {
            if (!visited.has(nodeId)) {
                dfs(nodeId);
            }
        }
        return cycles;
    }
    getTopologicalOrder() {
        const levels = [];
        const inDegree = new Map();
        const queue = [];
        // Initialize in-degrees
        for (const nodeId of this.nodes.keys()) {
            inDegree.set(nodeId, (this.reverseAdjacencyList.get(nodeId) || new Set()).size);
        }
        // Find nodes with no incoming edges
        for (const [nodeId, degree] of inDegree.entries()) {
            if (degree === 0) {
                queue.push(nodeId);
            }
        }
        let level = 0;
        let processedNodes = 0;
        while (queue.length > 0) {
            const currentLevel = [];
            const levelSize = queue.length;
            for (let i = 0; i < levelSize; i++) {
                const nodeId = queue.shift();
                currentLevel.push(nodeId);
                processedNodes++;
                // Update neighbors
                const neighbors = this.adjacencyList.get(nodeId) || new Set();
                for (const neighbor of neighbors) {
                    const newDegree = (inDegree.get(neighbor) || 0) - 1;
                    inDegree.set(neighbor, newDegree);
                    if (newDegree === 0) {
                        queue.push(neighbor);
                    }
                }
            }
            levels.push(currentLevel);
            level++;
        }
        return {
            levels,
            totalLevels: level,
            canEvaluate: processedNodes === this.nodes.size
        };
    }
    findStronglyConnectedComponents() {
        const components = [];
        const visited = new Set();
        const stack = [];
        // First DFS to fill the stack
        const fillOrder = (nodeId) => {
            if (visited.has(nodeId))
                return;
            visited.add(nodeId);
            const neighbors = this.adjacencyList.get(nodeId) || new Set();
            for (const neighbor of neighbors) {
                fillOrder(neighbor);
            }
            stack.push(nodeId);
        };
        // Fill the stack with finish times
        for (const nodeId of this.nodes.keys()) {
            fillOrder(nodeId);
        }
        // Reset visited for second DFS
        visited.clear();
        // Second DFS on reversed graph
        const collectComponent = (nodeId, component) => {
            if (visited.has(nodeId))
                return;
            visited.add(nodeId);
            component.push(nodeId);
            const neighbors = this.reverseAdjacencyList.get(nodeId) || new Set();
            for (const neighbor of neighbors) {
                collectComponent(neighbor, component);
            }
        };
        // Process nodes in reverse finish time order
        while (stack.length > 0) {
            const nodeId = stack.pop();
            if (!visited.has(nodeId)) {
                const component = [];
                collectComponent(nodeId, component);
                if (component.length > 0) {
                    components.push(component);
                }
            }
        }
        return components;
    }
    getStatistics() {
        const cycles = this.findCycles();
        const components = this.findStronglyConnectedComponents();
        const topOrder = this.getTopologicalOrder();
        let timeDependentNodes = 0;
        let isolatedNodes = 0;
        for (const variable of this.model.listVariables()) {
            if (variable.isTimeDependent()) {
                timeDependentNodes++;
            }
            const inDegree = (this.reverseAdjacencyList.get(variable.name) || new Set()).size;
            const outDegree = (this.adjacencyList.get(variable.name) || new Set()).size;
            if (inDegree === 0 && outDegree === 0) {
                isolatedNodes++;
            }
        }
        return {
            nodeCount: this.nodes.size,
            edgeCount: this.model.listEdges().length,
            maxLevel: topOrder.totalLevels,
            cycleCount: cycles.length,
            stronglyConnectedComponents: components.length,
            timeDependentNodes,
            isolatedNodes
        };
    }
    // Path finding
    findShortestPath(source, target) {
        if (!this.nodes.has(source) || !this.nodes.has(target)) {
            return null;
        }
        const queue = [source];
        const visited = new Set([source]);
        const parent = new Map();
        while (queue.length > 0) {
            const current = queue.shift();
            if (current === target) {
                // Reconstruct path
                const path = [];
                let node = target;
                while (node !== undefined) {
                    path.unshift(node);
                    node = parent.get(node);
                }
                return path;
            }
            const neighbors = this.adjacencyList.get(current) || new Set();
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    parent.set(neighbor, current);
                    queue.push(neighbor);
                }
            }
        }
        return null; // No path found
    }
    findAllPaths(source, target, maxLength = 10) {
        const paths = [];
        const currentPath = [];
        const dfs = (node, visited) => {
            if (currentPath.length > maxLength)
                return;
            currentPath.push(node);
            if (node === target) {
                paths.push([...currentPath]);
                currentPath.pop();
                return;
            }
            visited.add(node);
            const neighbors = this.adjacencyList.get(node) || new Set();
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    dfs(neighbor, new Set(visited));
                }
            }
            currentPath.pop();
        };
        if (this.nodes.has(source) && this.nodes.has(target)) {
            dfs(source, new Set());
        }
        return paths;
    }
    // Graph metrics for marketplace recommendations
    getNodeImportance(nodeId) {
        if (!this.nodes.has(nodeId))
            return 0;
        const inDegree = (this.reverseAdjacencyList.get(nodeId) || new Set()).size;
        const outDegree = (this.adjacencyList.get(nodeId) || new Set()).size;
        // Importance based on connectivity
        return (inDegree + outDegree) / (this.nodes.size * 2);
    }
    getGraphDensity() {
        const maxEdges = this.nodes.size * (this.nodes.size - 1);
        return maxEdges > 0 ? (this.model.listEdges().length / maxEdges) : 0;
    }
    // Subgraph operations for marketplace composition
    extractSubgraph(variableNames) {
        const subgraphData = {
            name: `${this.model.name}_subgraph`,
            description: `Subgraph of ${this.model.name}`,
            variables: [],
            edges: [],
            metadata: {
                ...this.model.metadata,
                derivedFrom: this.model.metadata?.marketplaceId || this.model.name,
                created: new Date()
            }
        };
        // Add variables
        for (const varName of variableNames) {
            const variable = this.model.getVariable(varName);
            if (variable) {
                subgraphData.variables.push(variable.toJSON());
            }
        }
        // Add edges between included variables
        for (const edge of this.model.listEdges()) {
            if (variableNames.includes(edge.source) && variableNames.includes(edge.target)) {
                subgraphData.edges.push(edge.toJSON());
            }
        }
        return new Model(subgraphData);
    }
    // Refresh graph after model changes
    refresh() {
        this.buildGraph();
    }
    // Export graph structure for visualization
    toGraphViz() {
        let dot = 'digraph ModelGraph {\n';
        dot += '  rankdir=LR;\n';
        dot += '  node [shape=box];\n\n';
        // Add nodes
        for (const [nodeId, node] of this.nodes.entries()) {
            const variable = node.variable;
            const label = `${nodeId}\\n${variable.type}`;
            const color = variable.isTimeDependent() ? 'lightblue' : 'lightgray';
            dot += `  "${nodeId}" [label="${label}", fillcolor="${color}", style=filled];\n`;
        }
        dot += '\n';
        // Add edges
        for (const edge of this.model.listEdges()) {
            const style = edge.type === 'temporal' ? 'dashed' : 'solid';
            const color = edge.type === 'dependency' ? 'blue' : 'black';
            dot += `  "${edge.source}" -> "${edge.target}" [style="${style}", color="${color}"];\n`;
        }
        dot += '}\n';
        return dot;
    }
}
