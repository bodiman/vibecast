/**
 * Storage layer for TribalKnowledge using Prisma/PostgreSQL
 */
import { TribalKnowledge } from './TribalKnowledge.js';
export class TribalKnowledgeStorage {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Save a TribalKnowledge graph to the database
     */
    async saveKnowledge(knowledge) {
        const data = knowledge.toJSON();
        const metadata = knowledge.getMetadata();
        // Check if knowledge already exists
        const existing = await this.prisma.tribalKnowledge.findFirst({
            where: {
                codespace: metadata.codespace,
                domain: metadata.domain
            }
        });
        if (existing) {
            // Update existing
            await this.prisma.tribalKnowledge.update({
                where: { id: existing.id },
                data: {
                    metadata: metadata,
                    nodes: data.nodes,
                    links: data.links,
                    version: metadata.version,
                    nodeCount: metadata.nodeCount,
                    linkCount: metadata.linkCount,
                    avgImportance: metadata.avgImportance,
                    visibility: metadata.visibility,
                    updatedAt: new Date()
                }
            });
        }
        else {
            // Create new
            await this.prisma.tribalKnowledge.create({
                data: {
                    codespace: metadata.codespace,
                    domain: metadata.domain,
                    description: metadata.description,
                    metadata: metadata,
                    nodes: data.nodes,
                    links: data.links,
                    version: metadata.version,
                    nodeCount: metadata.nodeCount,
                    linkCount: metadata.linkCount,
                    avgImportance: metadata.avgImportance,
                    visibility: metadata.visibility,
                    owner: metadata.owner,
                    published: metadata.published || false
                }
            });
        }
    }
    /**
     * Load a TribalKnowledge graph from the database
     */
    async loadKnowledge(codespace, domain) {
        const record = await this.prisma.tribalKnowledge.findFirst({
            where: {
                codespace,
                domain
            }
        });
        if (!record) {
            return null;
        }
        return TribalKnowledge.fromJSON({
            id: record.id,
            metadata: record.metadata,
            nodes: record.nodes,
            links: record.links
        });
    }
    /**
     * List all TribalKnowledge graphs
     */
    async listKnowledge(filter) {
        const where = {};
        if (filter?.codespace) {
            where.codespace = filter.codespace;
        }
        if (filter?.visibility) {
            where.visibility = filter.visibility;
        }
        if (filter?.owner) {
            where.owner = filter.owner;
        }
        const records = await this.prisma.tribalKnowledge.findMany({
            where,
            select: {
                codespace: true,
                domain: true,
                description: true,
                nodeCount: true,
                linkCount: true,
                updatedAt: true
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });
        return records.map(r => ({
            codespace: r.codespace,
            domain: r.domain,
            description: r.description || undefined,
            nodeCount: r.nodeCount,
            linkCount: r.linkCount,
            updated: r.updatedAt
        }));
    }
    /**
     * Delete a TribalKnowledge graph
     */
    async deleteKnowledge(codespace, domain) {
        await this.prisma.tribalKnowledge.deleteMany({
            where: {
                codespace,
                domain
            }
        });
    }
    /**
     * Search across all knowledge bases
     */
    async searchKnowledge(query, options) {
        const where = {};
        if (options?.codespace) {
            where.codespace = options.codespace;
        }
        if (options?.visibility) {
            where.visibility = options.visibility;
        }
        const records = await this.prisma.tribalKnowledge.findMany({
            where,
            take: options?.limit || 20
        });
        const results = [];
        for (const record of records) {
            const knowledge = TribalKnowledge.fromJSON({
                id: record.id,
                metadata: record.metadata,
                nodes: record.nodes,
                links: record.links
            });
            const matchingNodes = knowledge.searchNodes(query, { limit: 5 });
            if (matchingNodes.length > 0) {
                results.push({
                    codespace: record.codespace,
                    domain: record.domain,
                    matchingNodes: matchingNodes.map(n => ({
                        id: n.id,
                        title: n.title,
                        summary: n.summary,
                        type: n.type,
                        importance: n.importance
                    }))
                });
            }
        }
        return results;
    }
    /**
     * Publish to hub
     */
    async publishToHub(codespace, domain) {
        await this.prisma.tribalKnowledge.updateMany({
            where: {
                codespace,
                domain
            },
            data: {
                published: true,
                publishedAt: new Date(),
                visibility: 'public'
            }
        });
    }
    /**
     * Get hub statistics
     */
    async getHubStats(codespace, domain) {
        const record = await this.prisma.tribalKnowledge.findFirst({
            where: {
                codespace,
                domain
            },
            select: {
                stars: true,
                forks: true,
                downloads: true
            }
        });
        return record || { stars: 0, forks: 0, downloads: 0 };
    }
    /**
     * Star a knowledge base
     */
    async starKnowledge(codespace, domain) {
        const record = await this.prisma.tribalKnowledge.findFirst({
            where: { codespace, domain }
        });
        if (record) {
            await this.prisma.tribalKnowledge.update({
                where: { id: record.id },
                data: {
                    stars: (record.stars || 0) + 1
                }
            });
        }
    }
    /**
     * Fork a knowledge base
     */
    async forkKnowledge(sourceCodespace, sourceDomain, targetCodespace, targetDomain, owner) {
        const source = await this.loadKnowledge(sourceCodespace, sourceDomain);
        if (!source) {
            throw new Error(`Knowledge base ${sourceCodespace}/${sourceDomain} not found`);
        }
        // Increment fork count on source
        const sourceRecord = await this.prisma.tribalKnowledge.findFirst({
            where: { codespace: sourceCodespace, domain: sourceDomain }
        });
        if (sourceRecord) {
            await this.prisma.tribalKnowledge.update({
                where: { id: sourceRecord.id },
                data: {
                    forks: (sourceRecord.forks || 0) + 1
                }
            });
        }
        // Create fork
        const forked = source.fork(targetCodespace, targetDomain);
        // Save forked knowledge
        await this.saveKnowledge(forked);
        return forked;
    }
}
