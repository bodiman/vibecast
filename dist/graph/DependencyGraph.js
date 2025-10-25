export class DependencyGraph {
    constructor() {
        this.nodes = new Map();
        this.edges = [];
    }
    buildFromModel(model) {
        this.nodes.clear();
        this.edges.length = 0;
        // Create nodes for all variables
        for (const variable of model.listVariables()) {
            const node = {
                name: variable.name,
                variable: variable,
                dependencies: [...variable.dependencies],
                dependents: [],
                level: 0,
                isTimeDependent: variable.isTimeDependent(),
            };
            this.nodes.set(variable.name, node);
        }
        // Build edges and dependent relationships
        for (const variable of model.listVariables()) {
            for (const depName of variable.dependencies) {
                // Extract base variable name from time references
                const baseDepName = this.extractBaseVariableName(depName);
                this.addEdge(baseDepName, variable.name, depName.includes('[t') ? 'temporal' : 'direct');
                const depNode = this.nodes.get(baseDepName);
                if (depNode) {
                    depNode.dependents.push(variable.name);
                }
            }
        }
        // Calculate topological levels
        this.calculateLevels();
    }
    getNode(name) {
        return this.nodes.get(name);
    }
    getAllNodes() {
        return Array.from(this.nodes.values());
    }
    getEdges() {
        return [...this.edges];
    }
    getTopologicalOrder() {
        const visited = new Set();
        const visiting = new Set();
        const result = [];
        const visit = (nodeName) => {
            if (visiting.has(nodeName)) {
                throw new Error(`Circular dependency detected involving variable '${nodeName}'`);
            }
            if (visited.has(nodeName)) {
                return;
            }
            visiting.add(nodeName);
            const node = this.nodes.get(nodeName);
            if (node) {
                for (const depName of node.dependencies) {
                    // Only visit dependencies that exist in the graph
                    if (this.nodes.has(depName)) {
                        visit(depName);
                    }
                }
            }
            visiting.delete(nodeName);
            visited.add(nodeName);
            result.push(nodeName);
        };
        // Visit all nodes
        for (const nodeName of this.nodes.keys()) {
            if (!visited.has(nodeName)) {
                visit(nodeName);
            }
        }
        return result;
    }
    getEvaluationGroups() {
        const groups = [];
        const levelMap = new Map();
        // Group nodes by level
        for (const node of this.nodes.values()) {
            const level = node.level;
            if (!levelMap.has(level)) {
                levelMap.set(level, []);
            }
            levelMap.get(level).push(node.name);
        }
        // Sort groups by level
        const sortedLevels = Array.from(levelMap.keys()).sort((a, b) => a - b);
        for (const level of sortedLevels) {
            groups.push(levelMap.get(level));
        }
        return groups;
    }
    getDependents(variableName) {
        const node = this.nodes.get(variableName);
        return node ? [...node.dependents] : [];
    }
    getDependencies(variableName) {
        const node = this.nodes.get(variableName);
        return node ? [...node.dependencies] : [];
    }
    getAllDependencies(variableName) {
        const visited = new Set();
        const dependencies = new Set();
        const collectDeps = (nodeName) => {
            if (visited.has(nodeName))
                return;
            visited.add(nodeName);
            const node = this.nodes.get(nodeName);
            if (node) {
                for (const depName of node.dependencies) {
                    dependencies.add(depName);
                    collectDeps(depName);
                }
            }
        };
        collectDeps(variableName);
        return dependencies;
    }
    getAllDependents(variableName) {
        const visited = new Set();
        const dependents = new Set();
        const collectDependents = (nodeName) => {
            if (visited.has(nodeName))
                return;
            visited.add(nodeName);
            const node = this.nodes.get(nodeName);
            if (node) {
                for (const depName of node.dependents) {
                    dependents.add(depName);
                    collectDependents(depName);
                }
            }
        };
        collectDependents(variableName);
        return dependents;
    }
    isAcyclic() {
        try {
            this.getTopologicalOrder();
            return true;
        }
        catch (error) {
            return false;
        }
    }
    findCycles() {
        const cycles = [];
        const visited = new Set();
        const visiting = new Set();
        const path = [];
        const visit = (nodeName) => {
            if (visiting.has(nodeName)) {
                // Found a cycle - extract it from the path
                const cycleStart = path.indexOf(nodeName);
                if (cycleStart >= 0) {
                    cycles.push([...path.slice(cycleStart), nodeName]);
                }
                return;
            }
            if (visited.has(nodeName)) {
                return;
            }
            visiting.add(nodeName);
            path.push(nodeName);
            const node = this.nodes.get(nodeName);
            if (node) {
                for (const depName of node.dependencies) {
                    visit(depName);
                }
            }
            path.pop();
            visiting.delete(nodeName);
            visited.add(nodeName);
        };
        for (const nodeName of this.nodes.keys()) {
            if (!visited.has(nodeName)) {
                visit(nodeName);
            }
        }
        return cycles;
    }
    addEdge(from, to, type) {
        this.edges.push({ from, to, type });
    }
    extractBaseVariableName(depName) {
        // Extract base variable name from time references like VAR[t-1] -> VAR
        const timeRefMatch = depName.match(/^([A-Za-z_][A-Za-z0-9_]*)\[t[+-]?\d*\]$/);
        if (timeRefMatch) {
            return timeRefMatch[1];
        }
        return depName;
    }
    calculateLevels() {
        // Initialize all levels to 0
        for (const node of this.nodes.values()) {
            node.level = 0;
        }
        // Calculate levels using longest path from sources
        const topOrder = this.getTopologicalOrder();
        for (const nodeName of topOrder) {
            const node = this.nodes.get(nodeName);
            // Set level based on maximum dependency level + 1
            let maxDepLevel = -1;
            for (const depName of node.dependencies) {
                const depNode = this.nodes.get(depName);
                if (depNode) {
                    maxDepLevel = Math.max(maxDepLevel, depNode.level);
                }
            }
            node.level = maxDepLevel + 1;
        }
    }
    toJSON() {
        return {
            nodes: this.getAllNodes(),
            edges: this.getEdges(),
        };
    }
    getStatistics() {
        const cycles = this.findCycles();
        const timeDependentNodes = this.getAllNodes().filter(n => n.isTimeDependent).length;
        const maxLevel = Math.max(...this.getAllNodes().map(n => n.level));
        return {
            nodeCount: this.nodes.size,
            edgeCount: this.edges.length,
            maxLevel,
            timeDependentNodes,
            cycleCount: cycles.length,
        };
    }
}
