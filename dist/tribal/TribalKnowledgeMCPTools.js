/**
 * MCP Tools for TribalKnowledge
 *
 * Extends the Modelit MCP server with TribalKnowledge capabilities
 */
import { TribalKnowledge, KnowledgeNodeType, KnowledgeLinkType } from './TribalKnowledge.js';
import { TribalKnowledgeStorage } from './TribalKnowledgeStorage.js';
export class TribalKnowledgeMCPTools {
    constructor(prisma) {
        this.currentKnowledge = new Map(); // Cache by codespace:domain
        this.storage = new TribalKnowledgeStorage(prisma);
    }
    /**
     * Get current knowledge or create if doesn't exist
     */
    async getOrCreateKnowledge(codespace, domain) {
        const key = `${codespace}:${domain}`;
        if (this.currentKnowledge.has(key)) {
            return this.currentKnowledge.get(key);
        }
        // Try loading from storage
        let knowledge = await this.storage.loadKnowledge(codespace, domain);
        if (!knowledge) {
            // Create new
            knowledge = new TribalKnowledge(codespace, domain);
            await this.storage.saveKnowledge(knowledge);
        }
        this.currentKnowledge.set(key, knowledge);
        return knowledge;
    }
    /**
     * Define MCP tools for TribalKnowledge
     */
    getToolDefinitions() {
        return [
            {
                name: 'tribal_create_knowledge',
                description: 'Create a new TribalKnowledge base for a codespace and domain',
                inputSchema: {
                    type: 'object',
                    properties: {
                        codespace: { type: 'string', description: 'Codespace identifier (e.g., project name)' },
                        domain: { type: 'string', description: 'Domain area (e.g., frontend, api, database)' },
                        description: { type: 'string', description: 'Description of this knowledge base' },
                        visibility: { type: 'string', enum: ['private', 'team', 'public'], description: 'Visibility level' }
                    },
                    required: ['codespace', 'domain']
                }
            },
            {
                name: 'tribal_add_knowledge',
                description: 'Add a knowledge node to the TribalKnowledge base',
                inputSchema: {
                    type: 'object',
                    properties: {
                        codespace: { type: 'string' },
                        domain: { type: 'string' },
                        type: {
                            type: 'string',
                            enum: Object.values(KnowledgeNodeType),
                            description: 'Type of knowledge node'
                        },
                        title: { type: 'string', description: 'Title of the knowledge' },
                        summary: { type: 'string', description: 'Brief one-line summary' },
                        content: { type: 'string', description: 'Full content/details' },
                        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
                        importance: { type: 'number', description: 'Importance score 0-1', minimum: 0, maximum: 1 },
                        confidence: { type: 'number', description: 'Confidence score 0-1', minimum: 0, maximum: 1 }
                    },
                    required: ['codespace', 'domain', 'type', 'title', 'summary', 'content']
                }
            },
            {
                name: 'tribal_link_knowledge',
                description: 'Create a link between two knowledge nodes',
                inputSchema: {
                    type: 'object',
                    properties: {
                        codespace: { type: 'string' },
                        domain: { type: 'string' },
                        sourceId: { type: 'string', description: 'Source node ID' },
                        targetId: { type: 'string', description: 'Target node ID' },
                        linkType: {
                            type: 'string',
                            enum: Object.values(KnowledgeLinkType),
                            description: 'Type of relationship'
                        },
                        strength: { type: 'number', description: 'Link strength 0-1', minimum: 0, maximum: 1 },
                        reason: { type: 'string', description: 'Why these are linked' }
                    },
                    required: ['codespace', 'domain', 'sourceId', 'targetId', 'linkType']
                }
            },
            {
                name: 'tribal_get_context',
                description: 'Generate a context window from TribalKnowledge for an agent',
                inputSchema: {
                    type: 'object',
                    properties: {
                        codespace: { type: 'string' },
                        domain: { type: 'string' },
                        topic: { type: 'string', description: 'Focus topic (optional)' },
                        maxTokens: { type: 'number', description: 'Maximum tokens for context' }
                    },
                    required: ['codespace', 'domain']
                }
            },
            {
                name: 'tribal_search',
                description: 'Search for knowledge across all TribalKnowledge bases',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query' },
                        codespace: { type: 'string', description: 'Filter by codespace (optional)' },
                        type: {
                            type: 'string',
                            enum: Object.values(KnowledgeNodeType),
                            description: 'Filter by node type (optional)'
                        },
                        limit: { type: 'number', description: 'Maximum results', default: 10 }
                    },
                    required: ['query']
                }
            },
            {
                name: 'tribal_get_stats',
                description: 'Get statistics about a TribalKnowledge base',
                inputSchema: {
                    type: 'object',
                    properties: {
                        codespace: { type: 'string' },
                        domain: { type: 'string' }
                    },
                    required: ['codespace', 'domain']
                }
            },
            {
                name: 'tribal_visualize',
                description: 'Get visualization data for TribalKnowledge graph (use with /visualize command)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        codespace: { type: 'string' },
                        domain: { type: 'string' }
                    },
                    required: ['codespace', 'domain']
                }
            },
            {
                name: 'tribal_publish',
                description: 'Publish TribalKnowledge to the public hub',
                inputSchema: {
                    type: 'object',
                    properties: {
                        codespace: { type: 'string' },
                        domain: { type: 'string' }
                    },
                    required: ['codespace', 'domain']
                }
            },
            {
                name: 'tribal_fork',
                description: 'Fork a TribalKnowledge base from the hub',
                inputSchema: {
                    type: 'object',
                    properties: {
                        sourceCodespace: { type: 'string' },
                        sourceDomain: { type: 'string' },
                        targetCodespace: { type: 'string' },
                        targetDomain: { type: 'string' },
                        owner: { type: 'string' }
                    },
                    required: ['sourceCodespace', 'sourceDomain', 'targetCodespace', 'targetDomain']
                }
            },
            {
                name: 'tribal_list',
                description: 'List all available TribalKnowledge bases',
                inputSchema: {
                    type: 'object',
                    properties: {
                        codespace: { type: 'string', description: 'Filter by codespace (optional)' },
                        visibility: { type: 'string', enum: ['private', 'team', 'public'], description: 'Filter by visibility' }
                    }
                }
            }
        ];
    }
    /**
     * Handle tool calls
     */
    async handleToolCall(request) {
        const { name, arguments: args } = request.params;
        try {
            switch (name) {
                case 'tribal_create_knowledge':
                    return await this.handleCreateKnowledge(args);
                case 'tribal_add_knowledge':
                    return await this.handleAddKnowledge(args);
                case 'tribal_link_knowledge':
                    return await this.handleLinkKnowledge(args);
                case 'tribal_get_context':
                    return await this.handleGetContext(args);
                case 'tribal_search':
                    return await this.handleSearch(args);
                case 'tribal_get_stats':
                    return await this.handleGetStats(args);
                case 'tribal_visualize':
                    return await this.handleVisualize(args);
                case 'tribal_publish':
                    return await this.handlePublish(args);
                case 'tribal_fork':
                    return await this.handleFork(args);
                case 'tribal_list':
                    return await this.handleList(args);
                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${error instanceof Error ? error.message : String(error)}`
                    }
                ]
            };
        }
    }
    // === Tool Handlers ===
    async handleCreateKnowledge(args) {
        const { codespace, domain, description, visibility } = args;
        const knowledge = new TribalKnowledge(codespace, domain, {
            description,
            visibility: visibility || 'private'
        });
        await this.storage.saveKnowledge(knowledge);
        this.currentKnowledge.set(`${codespace}:${domain}`, knowledge);
        return {
            content: [{
                    type: 'text',
                    text: `Created TribalKnowledge base: ${codespace}/${domain}`
                }]
        };
    }
    async handleAddKnowledge(args) {
        const { codespace, domain, type, title, summary, content, tags, importance, confidence } = args;
        const knowledge = await this.getOrCreateKnowledge(codespace, domain);
        const node = knowledge.addNode({
            type: type,
            title,
            summary,
            content,
            tags: tags || [],
            importance: importance !== undefined ? importance : 0.5,
            confidence: confidence !== undefined ? confidence : 0.8,
            codespace,
            domain,
            sourceType: 'curated'
        });
        await this.storage.saveKnowledge(knowledge);
        return {
            content: [{
                    type: 'text',
                    text: `Added knowledge node: ${title} (ID: ${node.id})`
                }]
        };
    }
    async handleLinkKnowledge(args) {
        const { codespace, domain, sourceId, targetId, linkType, strength, reason } = args;
        const knowledge = await this.getOrCreateKnowledge(codespace, domain);
        const link = knowledge.addLink({
            source: sourceId,
            target: targetId,
            type: linkType,
            strength: strength !== undefined ? strength : 0.8,
            reason
        });
        await this.storage.saveKnowledge(knowledge);
        return {
            content: [{
                    type: 'text',
                    text: `Created link: ${sourceId} → ${targetId} (${linkType})`
                }]
        };
    }
    async handleGetContext(args) {
        const { codespace, domain, topic, maxTokens } = args;
        const knowledge = await this.getOrCreateKnowledge(codespace, domain);
        const context = knowledge.generateContextWindow({
            topic,
            maxTokens: maxTokens || 4000
        });
        return {
            content: [{
                    type: 'text',
                    text: context
                }]
        };
    }
    async handleSearch(args) {
        const { query, codespace, type, limit } = args;
        if (codespace) {
            // Search within specific codespace - need domain
            const knowledgeBases = await this.storage.listKnowledge({ codespace });
            const results = [];
            for (const kb of knowledgeBases) {
                const knowledge = await this.getOrCreateKnowledge(kb.codespace, kb.domain);
                const nodes = knowledge.searchNodes(query, { type, limit });
                if (nodes.length > 0) {
                    results.push({
                        codespace: kb.codespace,
                        domain: kb.domain,
                        nodes: nodes.map(n => ({
                            id: n.id,
                            title: n.title,
                            summary: n.summary,
                            type: n.type,
                            importance: n.importance
                        }))
                    });
                }
            }
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(results, null, 2)
                    }]
            };
        }
        else {
            // Global search
            const results = await this.storage.searchKnowledge(query, { limit });
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(results, null, 2)
                    }]
            };
        }
    }
    async handleGetStats(args) {
        const { codespace, domain } = args;
        const knowledge = await this.getOrCreateKnowledge(codespace, domain);
        const stats = knowledge.getStatistics();
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(stats, null, 2)
                }]
        };
    }
    async handleVisualize(args) {
        const { codespace, domain } = args;
        const knowledge = await this.getOrCreateKnowledge(codespace, domain);
        const data = knowledge.toJSON();
        // Convert to graph format compatible with GraphViewer3D
        const graphData = {
            nodes: data.nodes.map(node => ({
                id: node.id,
                name: node.title,
                type: node.type,
                values: node.usageCount ? [node.usageCount] : undefined,
                metadata: {
                    description: node.summary,
                    importance: node.importance,
                    confidence: node.confidence,
                    tags: node.tags,
                    ...node.metadata
                },
                position3D: node.position3D
            })),
            edges: data.links.map(link => ({
                id: link.id,
                source: link.source,
                target: link.target,
                type: link.type,
                metadata: {
                    strength: link.strength,
                    reason: link.reason
                }
            }))
        };
        const webUrl = `http://localhost:3000/visualize/${codespace}/${domain}`;
        return {
            content: [{
                    type: 'text',
                    text: `# TribalKnowledge Visualization

Codespace: ${codespace}
Domain: ${domain}

Stats:
- Nodes: ${graphData.nodes.length}
- Links: ${graphData.edges.length}

🔗 View in browser: ${webUrl}

Graph Data:
\`\`\`json
${JSON.stringify(graphData, null, 2)}
\`\`\`
`
                }]
        };
    }
    async handlePublish(args) {
        const { codespace, domain } = args;
        await this.storage.publishToHub(codespace, domain);
        return {
            content: [{
                    type: 'text',
                    text: `Published ${codespace}/${domain} to the public hub`
                }]
        };
    }
    async handleFork(args) {
        const { sourceCodespace, sourceDomain, targetCodespace, targetDomain, owner } = args;
        const forked = await this.storage.forkKnowledge(sourceCodespace, sourceDomain, targetCodespace, targetDomain, owner);
        this.currentKnowledge.set(`${targetCodespace}:${targetDomain}`, forked);
        return {
            content: [{
                    type: 'text',
                    text: `Forked ${sourceCodespace}/${sourceDomain} to ${targetCodespace}/${targetDomain}`
                }]
        };
    }
    async handleList(args) {
        const { codespace, visibility } = args;
        const knowledgeBases = await this.storage.listKnowledge({
            codespace,
            visibility
        });
        const list = knowledgeBases.map(kb => `- ${kb.codespace}/${kb.domain} (${kb.nodeCount} nodes, ${kb.linkCount} links) - Updated: ${kb.updated.toISOString()}`).join('\n');
        return {
            content: [{
                    type: 'text',
                    text: `Available TribalKnowledge bases:\n\n${list || 'No knowledge bases found'}`
                }]
        };
    }
}
