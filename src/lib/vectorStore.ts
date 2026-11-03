import { get, set } from 'idb-keyval';
import { DocumentChunk, GridNodeData } from '../types';

const STORAGE_KEY = 'gridscape_vector_memory_v1';

/**
 * Calculates cosine similarity between two vector arrays.
 * Returns a value between -1.0 and 1.0 (typically 0.0 to 1.0 for normalized text embeddings).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = a.length;
  for (let i = 0; i < len; i++) {
    const valA = a[i];
    const valB = b[i];
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Breaks plain text or markdown into semantic chunks with a sliding window.
 */
export function chunkPlainText(text: string, maxWords = 220, overlapWords = 35): string[] {
  if (!text || !text.trim()) return [];

  // Split by double line breaks first to respect paragraph boundaries
  const paragraphs = text.split(/\n\s*\n/);
  const wordsWithBreaks: string[] = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      wordsWithBreaks.push(...words, '\n\n');
    }
  }

  const chunks: string[] = [];
  let currentWords: string[] = [];

  for (let i = 0; i < wordsWithBreaks.length; i++) {
    const token = wordsWithBreaks[i];
    if (token === '\n\n') {
      if (currentWords.length >= maxWords * 0.6) {
        chunks.push(currentWords.join(' ').trim());
        const keepCount = Math.min(overlapWords, Math.floor(currentWords.length / 2));
        currentWords = currentWords.slice(currentWords.length - keepCount);
      }
    } else {
      currentWords.push(token);
      if (currentWords.length >= maxWords) {
        chunks.push(currentWords.join(' ').trim());
        currentWords = currentWords.slice(currentWords.length - overlapWords);
      }
    }
  }

  if (currentWords.length > 0) {
    const remaining = currentWords.join(' ').trim();
    if (remaining.length > 0) {
      chunks.push(remaining);
    }
  }

  return chunks.length > 0 ? chunks : [text.trim()];
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  filterNodeIds?: string[];
}

class VectorMemoryStore {
  private chunksByNode: Map<string, DocumentChunk[]> = new Map();
  private isInitialized = false;

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const stored = await get<Record<string, DocumentChunk[]>>(STORAGE_KEY);
      if (stored && typeof stored === 'object') {
        this.chunksByNode = new Map(Object.entries(stored));
      }
      this.isInitialized = true;
    } catch (err) {
      console.warn('Failed to load vector memory from IndexedDB:', err);
      this.chunksByNode = new Map();
      this.isInitialized = true;
    }
  }

  private async persist(): Promise<void> {
    try {
      const obj: Record<string, DocumentChunk[]> = {};
      this.chunksByNode.forEach((chunks, nodeId) => {
        if (chunks && chunks.length > 0) {
          obj[nodeId] = chunks;
        }
      });
      await set(STORAGE_KEY, obj);
    } catch (err) {
      console.error('Failed to persist vector memory to IndexedDB:', err);
    }
  }

  public async addNodeChunks(nodeId: string, chunks: DocumentChunk[]): Promise<void> {
    await this.init();
    if (!chunks || chunks.length === 0) return;
    this.chunksByNode.set(nodeId, chunks);
    await this.persist();
  }

  public async removeNodeChunks(nodeId: string): Promise<void> {
    await this.init();
    if (this.chunksByNode.has(nodeId)) {
      this.chunksByNode.delete(nodeId);
      await this.persist();
    }
  }

  public getNodeChunks(nodeId: string): DocumentChunk[] {
    return this.chunksByNode.get(nodeId) || [];
  }

  public getAllChunks(): DocumentChunk[] {
    const all: DocumentChunk[] = [];
    this.chunksByNode.forEach(chunks => {
      all.push(...chunks);
    });
    return all;
  }

  public getTotalChunkCount(): number {
    let count = 0;
    this.chunksByNode.forEach(chunks => {
      count += chunks.length;
    });
    return count;
  }

  public getIndexedNodeCount(): number {
    return this.chunksByNode.size;
  }

  /**
   * Performs high-speed Cosine Similarity search over in-memory vectors.
   */
  public search(queryVector: number[], options: SearchOptions = {}): SearchResult[] {
    if (!queryVector || queryVector.length === 0) return [];
    
    const topK = options.topK ?? 4;
    const minScore = options.minScore ?? 0.35;
    const filterNodeIds = options.filterNodeIds && options.filterNodeIds.length > 0 
      ? new Set(options.filterNodeIds) 
      : null;

    const results: SearchResult[] = [];

    this.chunksByNode.forEach((chunks, nodeId) => {
      if (filterNodeIds && !filterNodeIds.has(nodeId)) {
        return; // Skip if filter applies and node is not in filter
      }

      for (const chunk of chunks) {
        if (!chunk.embedding || chunk.embedding.length === 0) continue;
        const score = cosineSimilarity(queryVector, chunk.embedding);
        if (score >= minScore) {
          results.push({ chunk, score });
        }
      }
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Synchronizes vector memory from an array of canvas nodes.
   * Useful on boot, checkpoint rollback, or project import.
   */
  public async syncFromNodes(nodes: GridNodeData[]): Promise<void> {
    await this.init();
    let updated = false;

    for (const node of nodes) {
      const chunks = node.chunks || node.fileData?.chunks;
      if (chunks && chunks.length > 0) {
        // Ensure chunks have valid embeddings
        const validChunks = chunks.filter(c => c.embedding && c.embedding.length > 0);
        if (validChunks.length > 0) {
          this.chunksByNode.set(node.id, validChunks);
          updated = true;
        }
      }
    }

    if (updated) {
      await this.persist();
    }
  }

  public async clear(): Promise<void> {
    this.chunksByNode.clear();
    await set(STORAGE_KEY, {});
  }
}

export const vectorMemoryStore = new VectorMemoryStore();

/**
 * End-to-end vector retrieval: converts query text to vector via /api/embed,
 * then queries the local vector store with cosine similarity ranking.
 */
export async function retrieveRelevantChunks(
  prompt: string,
  options?: { topK?: number; minScore?: number; filterNodeIds?: string[]; apiKey?: string }
): Promise<SearchResult[]> {
  if (!prompt || !prompt.trim()) return [];
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options?.apiKey) {
      headers['x-api-key'] = options.apiKey;
    }
    const res = await fetch('/api/embed', {
      method: 'POST',
      headers,
      body: JSON.stringify({ texts: [prompt] })
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.embeddings || !data.embeddings[0]) return [];
    
    return vectorMemoryStore.search(data.embeddings[0], {
      topK: options?.topK ?? 4,
      minScore: options?.minScore ?? 0.35,
      filterNodeIds: options?.filterNodeIds
    });
  } catch (err) {
    console.warn('Vector memory retrieval had non-fatal error:', err);
    return [];
  }
}

