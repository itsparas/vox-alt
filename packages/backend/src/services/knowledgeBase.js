/**
 * Knowledge Base Service
 * CRUD + search for FAQs and knowledge base documents
 */

import { getDatabase } from '../db/index.js';
import { logger } from '../lib/logger.js';

const log = logger.child({ service: 'knowledgeBase' });

// ============================================
// FAQ Operations
// ============================================

/**
 * Create a new FAQ entry
 */
export async function createFAQ(tenantId, data) {
  const db = getDatabase();

  const faq = await db.fAQ.create({
    data: {
      tenantId,
      question: data.question,
      answer: data.answer,
      category: data.category || null,
      keywords: data.keywords || [],
      sortOrder: data.sortOrder || 0,
      isActive: data.isActive ?? true,
    },
  });

  log.info('FAQ created', { faqId: faq.id, tenantId });
  return faq;
}

/**
 * Update an existing FAQ
 */
export async function updateFAQ(id, tenantId, data) {
  const db = getDatabase();

  const existing = await db.fAQ.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  const faq = await db.fAQ.update({
    where: { id },
    data: {
      ...(data.question !== undefined && { question: data.question }),
      ...(data.answer !== undefined && { answer: data.answer }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.keywords !== undefined && { keywords: data.keywords }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  log.info('FAQ updated', { faqId: id, tenantId });
  return faq;
}

/**
 * Delete an FAQ
 */
export async function deleteFAQ(id, tenantId) {
  const db = getDatabase();

  const existing = await db.fAQ.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  await db.fAQ.delete({ where: { id } });
  log.info('FAQ deleted', { faqId: id, tenantId });
  return existing;
}

/**
 * Get a single FAQ by ID
 */
export async function getFAQById(id, tenantId) {
  const db = getDatabase();
  return db.fAQ.findFirst({ where: { id, tenantId } });
}

/**
 * List FAQs with filtering
 */
export async function listFAQs(tenantId, filters = {}) {
  const db = getDatabase();
  const {
    page = 1,
    limit = 50,
    category,
    isActive,
    search,
  } = filters;

  const where = {
    tenantId,
    ...(category && { category }),
    ...(typeof isActive === 'boolean' && { isActive }),
    ...(search && {
      OR: [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } },
        { keywords: { has: search.toLowerCase() } },
      ],
    }),
  };

  const [faqs, total] = await Promise.all([
    db.fAQ.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    }),
    db.fAQ.count({ where }),
  ]);

  return {
    faqs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  };
}

/**
 * Get all FAQ categories for a tenant
 */
export async function getFAQCategories(tenantId) {
  const db = getDatabase();

  const faqs = await db.fAQ.findMany({
    where: { tenantId, isActive: true, category: { not: null } },
    select: { category: true },
    distinct: ['category'],
  });

  return faqs.map(f => f.category).filter(Boolean);
}

/**
 * Search FAQs by keyword/embedding match
 * Returns the most relevant FAQs for a given query
 */
export async function searchFAQs(tenantId, query, limit = 5) {
  const db = getDatabase();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  // Simple keyword search — match against question, answer, and keywords
  const faqs = await db.fAQ.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { question: { contains: query, mode: 'insensitive' } },
        { answer: { contains: query, mode: 'insensitive' } },
        ...queryWords.map(word => ({
          question: { contains: word, mode: 'insensitive' },
        })),
        ...queryWords.map(word => ({
          keywords: { has: word },
        })),
      ],
    },
    orderBy: [{ hitCount: 'desc' }, { sortOrder: 'asc' }],
    take: limit,
  });

  return faqs;
}

/**
 * Record an FAQ hit (increment usage counter)
 */
export async function recordFAQHit(id) {
  const db = getDatabase();
  await db.fAQ.update({
    where: { id },
    data: {
      hitCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  }).catch(err => log.warn('Failed to record FAQ hit', { error: err.message }));
}

/**
 * Bulk import FAQs
 */
export async function bulkImportFAQs(tenantId, faqs) {
  const db = getDatabase();
  const results = [];

  for (const faq of faqs) {
    const created = await db.fAQ.create({
      data: {
        tenantId,
        question: faq.question,
        answer: faq.answer,
        category: faq.category || null,
        keywords: faq.keywords || [],
        sortOrder: faq.sortOrder || 0,
      },
    });
    results.push(created);
  }

  log.info('Bulk FAQ import complete', { tenantId, count: results.length });
  return results;
}

// ============================================
// Knowledge Base Operations
// ============================================

/**
 * Create a knowledge base document
 */
export async function createKnowledgeBase(tenantId, data) {
  const db = getDatabase();

  const doc = await db.knowledgeBase.create({
    data: {
      tenantId,
      title: data.title,
      description: data.description || null,
      sourceType: data.sourceType || 'manual',
      sourceUrl: data.sourceUrl || null,
      s3Key: data.s3Key || null,
      s3Bucket: data.s3Bucket || null,
      fileSize: data.fileSize || null,
      mimeType: data.mimeType || null,
      content: data.content || '',
      chunks: data.chunks || [],
      isActive: data.isActive ?? true,
      isProcessed: !!data.content,
      metadata: data.metadata || null,
    },
  });

  // If content is provided, chunk it
  if (data.content && !data.chunks?.length) {
    const chunks = chunkText(data.content);
    await db.knowledgeBase.update({
      where: { id: doc.id },
      data: { chunks, isProcessed: true },
    });
    doc.chunks = chunks;
    doc.isProcessed = true;
  }

  log.info('Knowledge base document created', { docId: doc.id, tenantId, sourceType: data.sourceType });
  return doc;
}

/**
 * Update a knowledge base document
 */
export async function updateKnowledgeBase(id, tenantId, data) {
  const db = getDatabase();

  const existing = await db.knowledgeBase.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  const updateData = {
    ...(data.title !== undefined && { title: data.title }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.isActive !== undefined && { isActive: data.isActive }),
    ...(data.metadata !== undefined && { metadata: data.metadata }),
  };

  // If content is updated, re-chunk
  if (data.content !== undefined) {
    updateData.content = data.content;
    updateData.chunks = chunkText(data.content);
    updateData.isProcessed = true;
  }

  const doc = await db.knowledgeBase.update({
    where: { id },
    data: updateData,
  });

  log.info('Knowledge base document updated', { docId: id, tenantId });
  return doc;
}

/**
 * Delete a knowledge base document
 */
export async function deleteKnowledgeBase(id, tenantId) {
  const db = getDatabase();

  const existing = await db.knowledgeBase.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  // Delete uploaded file if exists
  if (existing.s3Key) {
    try {
      const { deleteFile } = await import('./storage.js');
      await deleteFile(existing.s3Key, existing.s3Bucket);
    } catch (err) {
      log.warn('Failed to delete KB file from storage', { error: err.message });
    }
  }

  await db.knowledgeBase.delete({ where: { id } });
  log.info('Knowledge base document deleted', { docId: id, tenantId });
  return existing;
}

/**
 * List knowledge base documents
 */
export async function listKnowledgeBase(tenantId, filters = {}) {
  const db = getDatabase();
  const { page = 1, limit = 20, sourceType, isActive, search } = filters;

  const where = {
    tenantId,
    ...(sourceType && { sourceType }),
    ...(typeof isActive === 'boolean' && { isActive }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [docs, total] = await Promise.all([
    db.knowledgeBase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      select: {
        id: true,
        title: true,
        description: true,
        sourceType: true,
        sourceUrl: true,
        fileSize: true,
        mimeType: true,
        isActive: true,
        isProcessed: true,
        processingError: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.knowledgeBase.count({ where }),
  ]);

  return {
    documents: docs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  };
}

/**
 * Get a single knowledge base document
 */
export async function getKnowledgeBaseById(id, tenantId) {
  const db = getDatabase();
  return db.knowledgeBase.findFirst({ where: { id, tenantId } });
}

/**
 * Search knowledge base documents
 * Returns relevant text chunks for a query
 */
export async function searchKnowledgeBase(tenantId, query, limit = 5) {
  const db = getDatabase();
  const queryLower = query.toLowerCase();

  // Get all active documents for the tenant
  const docs = await db.knowledgeBase.findMany({
    where: { tenantId, isActive: true, isProcessed: true },
    select: { id: true, title: true, chunks: true, content: true },
  });

  // Simple text search across chunks
  const matches = [];
  for (const doc of docs) {
    const chunks = Array.isArray(doc.chunks) ? doc.chunks : [];
    for (const chunk of chunks) {
      const text = typeof chunk === 'string' ? chunk : chunk.text || '';
      if (text.toLowerCase().includes(queryLower)) {
        matches.push({
          documentId: doc.id,
          documentTitle: doc.title,
          text,
          score: calculateSimpleRelevance(text, queryLower),
        });
      }
    }

    // Also check full content if no chunk matches
    if (matches.length === 0 && doc.content.toLowerCase().includes(queryLower)) {
      // Extract a snippet around the match
      const idx = doc.content.toLowerCase().indexOf(queryLower);
      const start = Math.max(0, idx - 200);
      const end = Math.min(doc.content.length, idx + queryLower.length + 200);
      matches.push({
        documentId: doc.id,
        documentTitle: doc.title,
        text: doc.content.slice(start, end),
        score: 0.5,
      });
    }
  }

  // Sort by relevance and return top matches
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

/**
 * Build context string from FAQs and knowledge base for LLM injection
 */
export async function buildKnowledgeContext(tenantId, query) {
  const [faqResults, kbResults] = await Promise.all([
    searchFAQs(tenantId, query, 3),
    searchKnowledgeBase(tenantId, query, 3),
  ]);

  let context = '';

  if (faqResults.length > 0) {
    context += '\n\nRelevant FAQs:\n';
    for (const faq of faqResults) {
      context += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
      // Record hit asynchronously
      recordFAQHit(faq.id);
    }
  }

  if (kbResults.length > 0) {
    context += '\nRelevant Knowledge Base Information:\n';
    for (const result of kbResults) {
      context += `[${result.documentTitle}]: ${result.text}\n\n`;
    }
  }

  return context;
}

/**
 * Get all active FAQs formatted for system prompt
 */
export async function getFAQsForPrompt(tenantId) {
  const db = getDatabase();

  const faqs = await db.fAQ.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ hitCount: 'desc' }, { sortOrder: 'asc' }],
    take: 30, // Limit to top 30 most-used FAQs for token efficiency
    select: { question: true, answer: true, category: true },
  });

  if (faqs.length === 0) return '';

  let prompt = '\n\nFREQUENTLY ASKED QUESTIONS - Use these to answer common queries:\n';
  const categories = {};

  for (const faq of faqs) {
    const cat = faq.category || 'General';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(faq);
  }

  for (const [category, items] of Object.entries(categories)) {
    prompt += `\n[${category}]\n`;
    for (const item of items) {
      prompt += `Q: ${item.question}\nA: ${item.answer}\n`;
    }
  }

  return prompt;
}

// ============================================
// Helpers
// ============================================

/**
 * Chunk text into overlapping segments for search
 */
export function chunkText(text, chunkSize = 500, overlap = 100) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    // Try to end at a sentence boundary
    let chunkEnd = end;
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const boundary = Math.max(lastPeriod, lastNewline);
      if (boundary > start + chunkSize * 0.5) {
        chunkEnd = boundary + 1;
      }
    }

    const chunkText = text.slice(start, chunkEnd).trim();
    if (chunkText.length > 0) {
      chunks.push({ text: chunkText, index: chunks.length });
    }

    start = chunkEnd - overlap;
    if (start <= chunks.length > 0 ? (chunks[chunks.length - 1].index * chunkSize) : 0) {
      start = chunkEnd; // Prevent infinite loop
    }
  }

  return chunks;
}

/**
 * Simple relevance score calculation
 */
function calculateSimpleRelevance(text, query) {
  const textLower = text.toLowerCase();
  const words = query.split(/\s+/).filter(w => w.length > 2);
  let score = 0;

  // Exact match bonus
  if (textLower.includes(query)) {
    score += 1.0;
  }

  // Word match count
  for (const word of words) {
    if (textLower.includes(word)) {
      score += 0.3;
    }
  }

  return Math.min(score, 2.0);
}

export default {
  createFAQ,
  updateFAQ,
  deleteFAQ,
  getFAQById,
  listFAQs,
  getFAQCategories,
  searchFAQs,
  recordFAQHit,
  bulkImportFAQs,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  listKnowledgeBase,
  getKnowledgeBaseById,
  searchKnowledgeBase,
  buildKnowledgeContext,
  getFAQsForPrompt,
};
