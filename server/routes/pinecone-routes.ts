/**
 * Pinecone Management Routes
 * Handles vector database operations and health checks
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth-middleware';
import { getPineconeClient } from '../services/pinecone';

const router = Router();

// Pinecone health check
router.get('/pinecone/health', async (_req: Request, res: Response) => {
  try {
    const pinecone = getPineconeClient();
    // Test connection by listing indexes
    const indexes = await pinecone.listIndexes();
    res.json({ 
      success: true, 
      status: 'healthy',
      indexCount: indexes?.indexes?.length || 0
    });
  } catch (error) {
    console.error('Pinecone health check failed:', error);
    res.status(503).json({ 
      success: false, 
      error: 'Pinecone service unavailable',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get Pinecone namespaces
router.get('/pinecone/namespaces', authenticateToken, async (req: Request, res: Response) => {
  try {
    const pinecone = getPineconeClient();
    const indexName = process.env.PINECONE_INDEX || 'knowledge-assistant';
    const index = pinecone.index(indexName);
    
    const stats = await index.describeIndexStats();
    const namespaces = Object.keys(stats.namespaces || {});
    
    res.json({
      success: true,
      data: {
        indexName,
        namespaces,
        totalVectorCount: stats.totalVectorCount || 0
      }
    });
  } catch (error) {
    console.error('Error fetching Pinecone namespaces:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch namespaces',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get vectors from Pinecone
router.get('/pinecone/vectors', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { namespace, limit = '10' } = req.query;
    const pinecone = getPineconeClient();
    const indexName = process.env.PINECONE_INDEX || 'knowledge-assistant';
    const index = pinecone.index(indexName);
    
    // Get index stats for the namespace
    const stats = await index.describeIndexStats();
    const namespaceStats = namespace ? stats.namespaces?.[namespace as string] : null;
    
    res.json({
      success: true,
      data: {
        namespace: namespace || 'default',
        vectorCount: namespaceStats?.vectorCount || 0,
        limit: parseInt(limit as string)
      }
    });
  } catch (error) {
    console.error('Error fetching Pinecone vectors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vectors',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Search vectors in Pinecone
router.get('/pinecone/search', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { query, namespace, topK = '5' } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }
    
    const pinecone = getPineconeClient();
    const indexName = process.env.PINECONE_INDEX || 'knowledge-assistant';
    const index = pinecone.index(indexName);
    
    // For demo purposes, return search structure
    // In real implementation, you'd convert query to vector and search
    res.json({
      success: true,
      data: {
        query: query as string,
        namespace: namespace || 'default',
        topK: parseInt(topK as string),
        matches: [] // Would contain actual search results
      }
    });
  } catch (error) {
    console.error('Error searching Pinecone vectors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search vectors',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update vectors in Pinecone
router.put('/pinecone/vectors', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { vectors, namespace } = req.body;
    
    if (!vectors || !Array.isArray(vectors)) {
      return res.status(400).json({
        success: false,
        error: 'Vectors array is required'
      });
    }
    
    const pinecone = getPineconeClient();
    const indexName = process.env.PINECONE_INDEX || 'knowledge-assistant';
    const index = pinecone.index(indexName);
    
    // Upsert vectors
    await index.namespace(namespace || 'default').upsert(vectors);
    
    res.json({
      success: true,
      data: {
        upsertedCount: vectors.length,
        namespace: namespace || 'default'
      }
    });
  } catch (error) {
    console.error('Error updating Pinecone vectors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update vectors',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete vectors from Pinecone
router.delete('/pinecone/vectors', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { ids, namespace } = req.body;
    
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        error: 'Vector IDs array is required'
      });
    }
    
    const pinecone = getPineconeClient();
    const indexName = process.env.PINECONE_INDEX || 'knowledge-assistant';
    const index = pinecone.index(indexName);
    
    // Delete vectors
    await index.namespace(namespace || 'default').deleteMany(ids);
    
    res.json({
      success: true,
      data: {
        deletedCount: ids.length,
        namespace: namespace || 'default'
      }
    });
  } catch (error) {
    console.error('Error deleting Pinecone vectors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete vectors',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;