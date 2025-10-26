import { ChromaClient } from 'chromadb';

export interface SearchResult {
  frameworkId: string;
  name: string;
  score: number;
  description: string;
  nodeCount: number;
}

export interface FrameworkDocument {
  frameworkId: string;
  title: string;
  nodeNames: string[];
}

export class VectorSearchService {
  private client: ChromaClient;
  private collection: any;
  private isInitialized = false;
  private collectionName = 'framework_search';

  constructor() {
    this.client = new ChromaClient();
  }

  /**
   * Initialize the ChromaDB collection for framework search
   */
  async initializeCollection(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Get or create collection with default embedding function
      try {
        this.collection = await this.client.getCollection({
          name: this.collectionName,
        });
        console.log(`📚 Loaded existing ChromaDB collection: ${this.collectionName}`);
      } catch (error) {
        // Collection doesn't exist, create it with default embedding function
        this.collection = await this.client.createCollection({
          name: this.collectionName,
        });
        console.log(`🆕 Created new ChromaDB collection: ${this.collectionName}`);
      }

      this.isInitialized = true;
      console.log('✅ VectorSearchService initialized successfully with default embeddings');
    } catch (error) {
      console.error('❌ Failed to initialize VectorSearchService:', error);
      throw error;
    }
  }

  /**
   * Generate searchable document text from framework title and node names
   */
  private generateDocumentText(title: string, nodeNames: string[]): string {
    const cleanTitle = title.trim();
    const cleanNodeNames = nodeNames
      .map(name => name.trim())
      .filter(name => name.length > 0)
      .join(', ');
    
    return `${cleanTitle}: ${cleanNodeNames}`;
  }


  /**
   * Index a framework in the vector database
   */
  async indexFramework(frameworkId: string, title: string, nodeNames: string[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeCollection();
    }

    if (!this.isInitialized) {
      console.warn('⚠️ VectorSearchService not initialized, skipping indexing');
      return;
    }

    try {
      const documentText = this.generateDocumentText(title, nodeNames);
      
      // Remove existing entry if it exists
      await this.removeFramework(frameworkId);
      
      // Add new entry (ChromaDB will generate embeddings automatically)
      await this.collection.add({
        ids: [frameworkId],
        documents: [documentText],
        metadatas: [{
          frameworkId,
          title,
          nodeCount: nodeNames.length,
          indexedAt: new Date().toISOString()
        }]
      });

      console.log(`📝 Indexed framework: ${title} (${nodeNames.length} nodes)`);
    } catch (error) {
      console.error(`❌ Failed to index framework ${frameworkId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a framework from the vector database
   */
  async removeFramework(frameworkId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeCollection();
    }

    if (!this.isInitialized) {
      return;
    }

    try {
      await this.collection.delete({
        ids: [frameworkId]
      });
      console.log(`🗑️ Removed framework from index: ${frameworkId}`);
    } catch (error) {
      // Ignore errors when removing non-existent entries
      console.debug(`Framework ${frameworkId} not found in index (may not exist)`);
    }
  }

  /**
   * Perform semantic search across frameworks
   */
  async searchFrameworks(query: string, limit: number = 5): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initializeCollection();
    }

    if (!this.isInitialized) {
      console.warn('⚠️ VectorSearchService not initialized, returning empty results');
      return [];
    }

    try {
      // Use text-based query (ChromaDB will generate embeddings automatically)
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit,
        include: ['metadatas', 'distances']
      });

      if (!results.ids || results.ids.length === 0) {
        return [];
      }

      const searchResults: SearchResult[] = [];
      
      for (let i = 0; i < results.ids[0].length; i++) {
        const frameworkId = results.ids[0][i];
        const metadata = results.metadatas[0][i];
        const distance = results.distances[0][i];
        
        // Convert distance to similarity score (0-1, higher is better)
        const score = Math.max(0, 1 - distance);

        searchResults.push({
          frameworkId,
          name: metadata.title,
          score,
          description: metadata.description || '',
          nodeCount: metadata.nodeCount || 0
        });
      }

      console.log(`🔍 Semantic search for "${query}" returned ${searchResults.length} results`);
      return searchResults;
    } catch (error) {
      console.error('❌ Failed to perform semantic search:', error);
      throw error;
    }
  }

  /**
   * Reindex all frameworks from the database
   */
  async reindexAll(frameworks: FrameworkDocument[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeCollection();
    }

    if (!this.isInitialized) {
      console.warn('⚠️ VectorSearchService not initialized, skipping reindexing');
      return;
    }

    try {
      console.log(`🔄 Starting batch reindexing of ${frameworks.length} frameworks...`);
      
      // Clear existing collection
      await this.collection.delete({
        where: {} // Delete all
      });

      // Batch add all frameworks (ChromaDB will generate embeddings automatically)
      const ids: string[] = [];
      const documents: string[] = [];
      const metadatas: any[] = [];

      for (const framework of frameworks) {
        const documentText = this.generateDocumentText(framework.title, framework.nodeNames);
        
        ids.push(framework.frameworkId);
        documents.push(documentText);
        metadatas.push({
          frameworkId: framework.frameworkId,
          title: framework.title,
          nodeCount: framework.nodeNames.length,
          indexedAt: new Date().toISOString()
        });
      }

      if (ids.length > 0) {
        await this.collection.add({
          ids,
          documents,
          metadatas
        });
      }

      console.log(`✅ Successfully reindexed ${frameworks.length} frameworks`);
    } catch (error) {
      console.error('❌ Failed to reindex frameworks:', error);
      throw error;
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{ count: number; isInitialized: boolean }> {
    if (!this.isInitialized) {
      return { count: 0, isInitialized: false };
    }

    try {
      const count = await this.collection.count();
      return { count, isInitialized: true };
    } catch (error) {
      console.error('❌ Failed to get collection stats:', error);
      return { count: 0, isInitialized: false };
    }
  }

  /**
   * Check if the service is properly initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}
