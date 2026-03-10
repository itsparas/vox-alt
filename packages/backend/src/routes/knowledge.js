/**
 * FAQ & Knowledge Base Routes
 * CRUD for FAQs and knowledge base documents
 */

import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticate, tenantIsolation, authorize } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import {
  createFAQ,
  updateFAQ,
  deleteFAQ,
  getFAQById,
  listFAQs,
  getFAQCategories,
  searchFAQs,
  bulkImportFAQs,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  listKnowledgeBase,
  getKnowledgeBaseById,
  searchKnowledgeBase,
  chunkText,
} from '../services/knowledgeBase.js';
import { parseDocument, getMimeType, isSupportedType, getSupportedExtensions } from '../services/documentParser.js';
import { logger } from '../lib/logger.js';
import multer from 'multer';

const router = Router();

// Multer config for document uploads (10 MB limit, memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ============================================
// FAQ Routes
// ============================================

/**
 * GET /api/knowledge/faqs
 * List FAQs with filtering
 */
router.get('/faqs',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const { page, limit, category, isActive, search } = req.query;
    const filters = {
      page,
      limit,
      category,
      search,
    };
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const result = await listFAQs(req.tenantId, filters);
    res.json({ success: true, data: result.faqs, pagination: result.pagination });
  })
);

/**
 * GET /api/knowledge/faqs/categories
 * Get all FAQ categories
 */
router.get('/faqs/categories',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const categories = await getFAQCategories(req.tenantId);
    res.json({ success: true, data: categories });
  })
);

/**
 * GET /api/knowledge/faqs/search
 * Search FAQs by query
 */
router.get('/faqs/search',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const { q, limit } = req.query;
    if (!q) throw ApiError.badRequest('Query parameter "q" is required');

    const results = await searchFAQs(req.tenantId, q, parseInt(limit) || 5);
    res.json({ success: true, data: results });
  })
);

/**
 * GET /api/knowledge/faqs/:id
 * Get a single FAQ
 */
router.get('/faqs/:id',
  authenticate,
  tenantIsolation,
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw ApiError.badRequest('Invalid FAQ ID');

    const faq = await getFAQById(req.params.id, req.tenantId);
    if (!faq) throw ApiError.notFound('FAQ not found');

    res.json({ success: true, data: faq });
  })
);

/**
 * POST /api/knowledge/faqs
 * Create a new FAQ
 */
router.post('/faqs',
  authenticate,
  tenantIsolation,
  authorize('TENANT_ADMIN', 'AGENT'),
  [
    body('question').isString().isLength({ min: 3 }).withMessage('Question is required'),
    body('answer').isString().isLength({ min: 1 }).withMessage('Answer is required'),
    body('category').optional().isString(),
    body('keywords').optional().isArray(),
    body('sortOrder').optional().isInt(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw ApiError.badRequest('Invalid FAQ data', errors.array());

    const faq = await createFAQ(req.tenantId, req.body);
    res.status(201).json({ success: true, data: faq });
  })
);

/**
 * PUT /api/knowledge/faqs/:id
 * Update an FAQ
 */
router.put('/faqs/:id',
  authenticate,
  tenantIsolation,
  authorize('TENANT_ADMIN', 'AGENT'),
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw ApiError.badRequest('Invalid FAQ ID');

    const faq = await updateFAQ(req.params.id, req.tenantId, req.body);
    if (!faq) throw ApiError.notFound('FAQ not found');

    res.json({ success: true, data: faq });
  })
);

/**
 * DELETE /api/knowledge/faqs/:id
 * Delete an FAQ
 */
router.delete('/faqs/:id',
  authenticate,
  tenantIsolation,
  authorize('TENANT_ADMIN'),
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw ApiError.badRequest('Invalid FAQ ID');

    const deleted = await deleteFAQ(req.params.id, req.tenantId);
    if (!deleted) throw ApiError.notFound('FAQ not found');

    res.json({ success: true, message: 'FAQ deleted' });
  })
);

/**
 * POST /api/knowledge/faqs/bulk
 * Bulk import FAQs
 */
router.post('/faqs/bulk',
  authenticate,
  tenantIsolation,
  authorize('TENANT_ADMIN'),
  body('faqs').isArray({ min: 1 }).withMessage('faqs must be a non-empty array'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw ApiError.badRequest('Invalid request body');

    const results = await bulkImportFAQs(req.tenantId, req.body.faqs);
    res.status(201).json({ success: true, data: results, count: results.length });
  })
);

// ============================================
// Knowledge Base Routes
// ============================================

/**
 * GET /api/knowledge/documents
 * List knowledge base documents
 */
router.get('/documents',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const { page, limit, sourceType, isActive, search } = req.query;
    const filters = {
      page,
      limit,
      sourceType,
      search,
    };
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const result = await listKnowledgeBase(req.tenantId, filters);
    res.json({ success: true, data: result.documents, pagination: result.pagination });
  })
);

/**
 * GET /api/knowledge/documents/search
 * Search knowledge base
 */
router.get('/documents/search',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const { q, limit } = req.query;
    if (!q) throw ApiError.badRequest('Query parameter "q" is required');

    const results = await searchKnowledgeBase(req.tenantId, q, parseInt(limit) || 5);
    res.json({ success: true, data: results });
  })
);

/**
 * GET /api/knowledge/documents/:id
 * Get a single document
 */
router.get('/documents/:id',
  authenticate,
  tenantIsolation,
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw ApiError.badRequest('Invalid document ID');

    const doc = await getKnowledgeBaseById(req.params.id, req.tenantId);
    if (!doc) throw ApiError.notFound('Document not found');

    res.json({ success: true, data: doc });
  })
);

/**
 * POST /api/knowledge/documents
 * Create a knowledge base document (manual text entry)
 */
router.post('/documents',
  authenticate,
  tenantIsolation,
  authorize('TENANT_ADMIN', 'AGENT'),
  [
    body('title').isString().isLength({ min: 1 }).withMessage('Title is required'),
    body('content').isString().isLength({ min: 1 }).withMessage('Content is required'),
    body('description').optional().isString(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw ApiError.badRequest('Invalid document data', errors.array());

    const doc = await createKnowledgeBase(req.tenantId, {
      ...req.body,
      sourceType: 'manual',
    });
    res.status(201).json({ success: true, data: doc });
  })
);

/**
 * PUT /api/knowledge/documents/:id
 * Update a knowledge base document
 */
router.put('/documents/:id',
  authenticate,
  tenantIsolation,
  authorize('TENANT_ADMIN', 'AGENT'),
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw ApiError.badRequest('Invalid document ID');

    const doc = await updateKnowledgeBase(req.params.id, req.tenantId, req.body);
    if (!doc) throw ApiError.notFound('Document not found');

    res.json({ success: true, data: doc });
  })
);

/**
 * DELETE /api/knowledge/documents/:id
 * Delete a knowledge base document
 */
router.delete('/documents/:id',
  authenticate,
  tenantIsolation,
  authorize('TENANT_ADMIN'),
  param('id').isUUID(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw ApiError.badRequest('Invalid document ID');

    const deleted = await deleteKnowledgeBase(req.params.id, req.tenantId);
    if (!deleted) throw ApiError.notFound('Document not found');

    res.json({ success: true, message: 'Document deleted' });
  })
);

/**
 * POST /api/knowledge/documents/upload
 * Upload and parse a document file into a knowledge base entry
 * Accepts multipart/form-data with a 'file' field
 */
router.post('/documents/upload',
  authenticate,
  tenantIsolation,
  authorize('TENANT_ADMIN', 'AGENT'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    // Check for file in request
    if (!req.file) {
      throw ApiError.badRequest('No file uploaded. Send a file in the "file" field.');
    }

    const uploadedFile = req.file;
    const mimeType = uploadedFile.mimetype || getMimeType(uploadedFile.originalname);

    if (!mimeType || !isSupportedType(mimeType)) {
      throw ApiError.badRequest(
        `Unsupported file type. Supported extensions: ${getSupportedExtensions().join(', ')}`
      );
    }

    // Parse the document
    const { content, metadata } = await parseDocument(
      uploadedFile.buffer,
      mimeType,
      uploadedFile.originalname
    );

    // Chunk the content
    const chunks = chunkText(content);

    // Create knowledge base entry
    const doc = await createKnowledgeBase(req.tenantId, {
      title: req.body.title || uploadedFile.originalname.replace(/\.[^.]+$/, ''),
      description: req.body.description || null,
      content,
      chunks,
      sourceType: 'upload',
      mimeType,
      fileSize: uploadedFile.size,
      isProcessed: true,
      metadata,
    });

    logger.info('Document uploaded and parsed', {
      tenantId: req.tenantId,
      docId: doc.id,
      fileName: uploadedFile.originalname,
      chunks: chunks.length,
    });

    res.status(201).json({
      success: true,
      data: doc,
      parsing: {
        characters: metadata.characterCount,
        words: metadata.wordCount,
        chunks: chunks.length,
      },
    });
  })
);

/**
 * GET /api/knowledge/documents/supported-types
 * List supported file types for upload
 */
router.get('/documents/supported-types',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      extensions: getSupportedExtensions(),
      maxSizeMB: 10,
    });
  })
);

export default router;
