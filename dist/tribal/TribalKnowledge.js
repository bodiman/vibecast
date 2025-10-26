/**
 * TribalKnowledge - Distilled context graph for expert agents
 *
 * A TribalKnowledge graph contains curated, interconnected knowledge nodes
 * that represent the most important information for an agent working in a
 * specific codespace or domain. It evolves over time as agents learn and
 * share insights.
 */
import crypto from 'crypto';
const randomUUID = crypto.randomUUID;
export var KnowledgeNodeType;
(function (KnowledgeNodeType) {
    KnowledgeNodeType["CONCEPT"] = "concept";
    KnowledgeNodeType["PATTERN"] = "pattern";
    KnowledgeNodeType["GOTCHA"] = "gotcha";
    KnowledgeNodeType["EXAMPLE"] = "example";
    KnowledgeNodeType["DECISION"] = "decision";
    KnowledgeNodeType["TOOL"] = "tool";
    KnowledgeNodeType["CONTEXT"] = "context";
    KnowledgeNodeType["REFERENCE"] = "reference";
    KnowledgeNodeType["WORKFLOW"] = "workflow";
    KnowledgeNodeType["INSIGHT"] = "insight"; // Learned insight
})(KnowledgeNodeType || (KnowledgeNodeType = {}));
export var KnowledgeLinkType;
(function (KnowledgeLinkType) {
    KnowledgeLinkType["RELATED_TO"] = "related_to";
    KnowledgeLinkType["REQUIRES"] = "requires";
    KnowledgeLinkType["CONFLICTS_WITH"] = "conflicts_with";
    KnowledgeLinkType["EXAMPLE_OF"] = "example_of";
    KnowledgeLinkType["LEADS_TO"] = "leads_to";
    KnowledgeLinkType["ALTERNATIVE_TO"] = "alternative_to";
    KnowledgeLinkType["DEPENDS_ON"] = "depends_on";
    KnowledgeLinkType["DERIVED_FROM"] = "derived_from";
    KnowledgeLinkType["SUPERSEDES"] = "supersedes";
    KnowledgeLinkType["REFERENCES"] = "references"; // External reference
})(KnowledgeLinkType || (KnowledgeLinkType = {}));
export class TribalKnowledge {
    constructor(codespace, domain, options) {
        this.id = randomUUID();
        this.nodes = new Map();
        this.links = new Map();
        this.metadata = {
            codespace,
            domain,
            version: '1.0.0',
            nodeCount: 0,
            linkCount: 0,
            avgImportance: 0,
            visibility: 'private',
            created: new Date(),
            updated: new Date(),
            ...options
        };
    }
    // === Node Operations ===
    addNode(node) {
        const fullNode = {
            ...node,
            id: randomUUID(),
            created: new Date(),
            updated: new Date(),
            usageCount: 0
        };
        this.nodes.set(fullNode.id, fullNode);
        this.updateMetadata();
        return fullNode;
    }
    getNode(id) {
        const node = this.nodes.get(id);
        if (node) {
            node.usageCount++;
            node.lastAccessed = new Date();
        }
        return node;
    }
    updateNode(id, updates) {
        const node = this.nodes.get(id);
        if (!node) {
            throw new Error(`Node ${id} not found`);
        }
        Object.assign(node, updates, { updated: new Date() });
        this.updateMetadata();
    }
    removeNode(id) {
        // Remove node
        this.nodes.delete(id);
        // Remove associated links
        const linksToRemove = Array.from(this.links.values())
            .filter(link => link.source === id || link.target === id)
            .map(link => link.id);
        linksToRemove.forEach(linkId => this.links.delete(linkId));
        this.updateMetadata();
    }
    listNodes(filter) {
        let nodes = Array.from(this.nodes.values());
        if (filter?.type) {
            nodes = nodes.filter(n => n.type === filter.type);
        }
        if (filter?.tags && filter.tags.length > 0) {
            nodes = nodes.filter(n => filter.tags.some(tag => n.tags.includes(tag)));
        }
        if (filter?.minImportance !== undefined) {
            nodes = nodes.filter(n => n.importance >= filter.minImportance);
        }
        if (filter?.codespace) {
            nodes = nodes.filter(n => n.codespace === filter.codespace);
        }
        return nodes;
    }
    // === Link Operations ===
    addLink(link) {
        // Validate nodes exist
        if (!this.nodes.has(link.source)) {
            throw new Error(`Source node ${link.source} not found`);
        }
        if (!this.nodes.has(link.target)) {
            throw new Error(`Target node ${link.target} not found`);
        }
        const fullLink = {
            ...link,
            id: randomUUID(),
            created: new Date()
        };
        this.links.set(fullLink.id, fullLink);
        this.updateMetadata();
        return fullLink;
    }
    getLink(id) {
        return this.links.get(id);
    }
    removeLink(id) {
        this.links.delete(id);
        this.updateMetadata();
    }
    getNodeLinks(nodeId, direction) {
        const links = Array.from(this.links.values());
        switch (direction) {
            case 'in':
                return links.filter(link => link.target === nodeId);
            case 'out':
                return links.filter(link => link.source === nodeId);
            case 'both':
            default:
                return links.filter(link => link.source === nodeId || link.target === nodeId);
        }
    }
    // === Graph Operations ===
    getConnectedNodes(nodeId, depth = 1) {
        const visited = new Set();
        const queue = [{ id: nodeId, currentDepth: 0 }];
        while (queue.length > 0) {
            const { id, currentDepth } = queue.shift();
            if (visited.has(id) || currentDepth > depth) {
                continue;
            }
            visited.add(id);
            // Get connected nodes
            const links = this.getNodeLinks(id);
            for (const link of links) {
                const connectedId = link.source === id ? link.target : link.source;
                if (!visited.has(connectedId)) {
                    queue.push({ id: connectedId, currentDepth: currentDepth + 1 });
                }
            }
        }
        visited.delete(nodeId); // Remove the starting node
        return visited;
    }
    getPath(startId, endId) {
        // BFS to find shortest path
        const queue = [{ id: startId, path: [startId] }];
        const visited = new Set();
        while (queue.length > 0) {
            const { id, path } = queue.shift();
            if (id === endId) {
                return path.map(nodeId => this.nodes.get(nodeId));
            }
            if (visited.has(id)) {
                continue;
            }
            visited.add(id);
            const links = this.getNodeLinks(id, 'out');
            for (const link of links) {
                if (!visited.has(link.target)) {
                    queue.push({ id: link.target, path: [...path, link.target] });
                }
            }
        }
        return null; // No path found
    }
    // === Search & Discovery ===
    searchNodes(query, options) {
        const queryLower = query.toLowerCase();
        let results = Array.from(this.nodes.values()).filter(node => node.title.toLowerCase().includes(queryLower) ||
            node.summary.toLowerCase().includes(queryLower) ||
            node.content.toLowerCase().includes(queryLower) ||
            node.tags.some(tag => tag.toLowerCase().includes(queryLower)));
        if (options?.type) {
            results = results.filter(n => n.type === options.type);
        }
        if (options?.tags && options.tags.length > 0) {
            results = results.filter(n => options.tags.some(tag => n.tags.includes(tag)));
        }
        // Sort by relevance (importance * confidence * usage)
        results.sort((a, b) => {
            const scoreA = a.importance * a.confidence * Math.log(a.usageCount + 1);
            const scoreB = b.importance * b.confidence * Math.log(b.usageCount + 1);
            return scoreB - scoreA;
        });
        if (options?.limit) {
            results = results.slice(0, options.limit);
        }
        return results;
    }
    getTopNodes(limit = 10, criteria = 'importance') {
        const nodes = Array.from(this.nodes.values());
        switch (criteria) {
            case 'importance':
                return nodes.sort((a, b) => b.importance - a.importance).slice(0, limit);
            case 'usage':
                return nodes.sort((a, b) => b.usageCount - a.usageCount).slice(0, limit);
            case 'recent':
                return nodes.sort((a, b) => b.updated.getTime() - a.updated.getTime()).slice(0, limit);
        }
    }
    // === Context Generation ===
    generateContextWindow(focus) {
        let nodes;
        if (focus?.nodeIds) {
            // Get specific nodes and their neighbors
            const nodeSet = new Set(focus.nodeIds);
            focus.nodeIds.forEach(id => {
                const connected = this.getConnectedNodes(id, 1);
                connected.forEach(connectedId => nodeSet.add(connectedId));
            });
            nodes = Array.from(nodeSet).map(id => this.nodes.get(id)).filter(Boolean);
        }
        else if (focus?.topic) {
            // Search for relevant nodes
            nodes = this.searchNodes(focus.topic, { limit: 20 });
        }
        else {
            // Get top important nodes
            nodes = this.getTopNodes(20, 'importance');
        }
        // Sort by importance
        nodes.sort((a, b) => b.importance - a.importance);
        // Build context string
        let context = `# TribalKnowledge: ${this.metadata.domain}\n\n`;
        context += `Codespace: ${this.metadata.codespace}\n`;
        context += `Last Updated: ${this.metadata.updated.toISOString()}\n\n`;
        context += `## Key Knowledge\n\n`;
        for (const node of nodes) {
            const section = this.formatNodeForContext(node);
            // Simple token estimation (rough)
            if (focus?.maxTokens && context.length + section.length > focus.maxTokens * 4) {
                break;
            }
            context += section + '\n\n';
        }
        return context;
    }
    formatNodeForContext(node) {
        let section = `### ${node.title}\n`;
        section += `**Type:** ${node.type} | **Importance:** ${(node.importance * 100).toFixed(0)}%\n\n`;
        section += `${node.summary}\n\n`;
        if (node.content) {
            section += `${node.content}\n`;
        }
        if (node.tags.length > 0) {
            section += `\n*Tags: ${node.tags.join(', ')}*\n`;
        }
        // Add related nodes
        const links = this.getNodeLinks(node.id, 'out');
        if (links.length > 0) {
            const relatedNodes = links
                .filter(link => link.type === KnowledgeLinkType.RELATED_TO || link.type === KnowledgeLinkType.REQUIRES)
                .slice(0, 3)
                .map(link => {
                const targetNode = this.nodes.get(link.target);
                return targetNode ? `${targetNode.title}` : null;
            })
                .filter(Boolean);
            if (relatedNodes.length > 0) {
                section += `\n*Related: ${relatedNodes.join(', ')}*\n`;
            }
        }
        return section;
    }
    // === Metadata & Statistics ===
    updateMetadata() {
        this.metadata.nodeCount = this.nodes.size;
        this.metadata.linkCount = this.links.size;
        this.metadata.updated = new Date();
        // Calculate average importance
        if (this.nodes.size > 0) {
            const totalImportance = Array.from(this.nodes.values())
                .reduce((sum, node) => sum + node.importance, 0);
            this.metadata.avgImportance = totalImportance / this.nodes.size;
        }
    }
    getMetadata() {
        return { ...this.metadata };
    }
    getStatistics() {
        const nodes = Array.from(this.nodes.values());
        const links = Array.from(this.links.values());
        // Node type distribution
        const nodeTypeDistribution = {};
        for (const node of nodes) {
            nodeTypeDistribution[node.type] = (nodeTypeDistribution[node.type] || 0) + 1;
        }
        // Link type distribution
        const linkTypeDistribution = {};
        for (const link of links) {
            linkTypeDistribution[link.type] = (linkTypeDistribution[link.type] || 0) + 1;
        }
        // Most used tags
        const tagCounts = {};
        for (const node of nodes) {
            for (const tag of node.tags) {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
        }
        const topTags = Object.entries(tagCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([tag, count]) => ({ tag, count }));
        return {
            ...this.metadata,
            nodeTypeDistribution,
            linkTypeDistribution,
            topTags,
            avgConfidence: nodes.reduce((sum, n) => sum + n.confidence, 0) / nodes.length,
            totalUsage: nodes.reduce((sum, n) => sum + n.usageCount, 0)
        };
    }
    // === Serialization ===
    toJSON() {
        return {
            id: this.id,
            metadata: this.metadata,
            nodes: Array.from(this.nodes.values()),
            links: Array.from(this.links.values())
        };
    }
    static fromJSON(data) {
        const tk = new TribalKnowledge(data.metadata.codespace, data.metadata.domain);
        tk.id = data.id;
        tk.metadata = data.metadata;
        // Restore nodes
        for (const node of data.nodes) {
            tk.nodes.set(node.id, node);
        }
        // Restore links
        for (const link of data.links) {
            tk.links.set(link.id, link);
        }
        return tk;
    }
    // === Merging & Forking ===
    merge(other, conflictResolution = 'keep-both') {
        // Merge nodes
        for (const [id, node] of other.nodes) {
            if (this.nodes.has(id)) {
                // Conflict resolution
                if (conflictResolution === 'keep-theirs') {
                    this.nodes.set(id, node);
                }
                else if (conflictResolution === 'keep-both') {
                    // Create new node with merged content
                    const existingNode = this.nodes.get(id);
                    const mergedNode = {
                        ...existingNode,
                        content: `${existingNode.content}\n\n---\n\n${node.content}`,
                        updated: new Date(),
                        sources: [...(existingNode.sources || []), ...(node.sources || [])]
                    };
                    this.nodes.set(id, mergedNode);
                }
                // 'keep-ours' does nothing
            }
            else {
                this.nodes.set(id, node);
            }
        }
        // Merge links
        for (const [id, link] of other.links) {
            if (!this.links.has(id)) {
                this.links.set(id, link);
            }
        }
        this.updateMetadata();
    }
    fork(newCodespace, newDomain) {
        const forked = new TribalKnowledge(newCodespace || this.metadata.codespace, newDomain || this.metadata.domain, {
            description: `Forked from ${this.metadata.codespace}/${this.metadata.domain}`,
            visibility: 'private'
        });
        // Copy all nodes
        for (const [id, node] of this.nodes) {
            forked.nodes.set(id, { ...node, sourceType: 'imported' });
        }
        // Copy all links
        for (const [id, link] of this.links) {
            forked.links.set(id, { ...link });
        }
        forked.updateMetadata();
        return forked;
    }
}
