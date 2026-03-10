/**
 * Document Parser Service
 * Extracts text from uploaded files (PDF, DOCX, TXT, CSV, MD)
 * and creates knowledge base entries with chunked content.
 */

import fs from 'fs/promises';
import path from 'path';
import { logger, createLogger } from '../lib/logger.js';

const log = createLogger('document-parser');

/**
 * Supported MIME types and their handlers
 */
const SUPPORTED_TYPES = {
  'text/plain': 'text',
  'text/csv': 'text',
  'text/markdown': 'text',
  'text/html': 'html',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/json': 'json',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Parse a document file and extract its text content.
 *
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - MIME type of the file
 * @param {string} fileName - Original file name
 * @returns {Promise<{content: string, metadata: object}>}
 */
export async function parseDocument(buffer, mimeType, fileName) {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
  }

  const handler = SUPPORTED_TYPES[mimeType];
  if (!handler) {
    throw new Error(
      `Unsupported file type: ${mimeType}. Supported types: ${Object.keys(SUPPORTED_TYPES).join(', ')}`
    );
  }

  log.info('Parsing document', { fileName, mimeType, size: buffer.length });

  let content = '';
  const metadata = {
    fileName,
    mimeType,
    fileSize: buffer.length,
    parsedAt: new Date().toISOString(),
  };

  switch (handler) {
    case 'text':
      content = parseText(buffer);
      break;
    case 'html':
      content = parseHTML(buffer);
      break;
    case 'json':
      content = parseJSON(buffer);
      break;
    case 'pdf':
      content = await parsePDF(buffer);
      break;
    case 'docx':
      content = await parseDOCX(buffer);
      break;
    case 'doc':
      content = parseText(buffer); // Fallback to raw text extraction
      break;
    default:
      throw new Error(`No parser implemented for handler: ${handler}`);
  }

  // Clean up the extracted content
  content = cleanText(content);

  if (!content || content.trim().length === 0) {
    throw new Error('No text content could be extracted from the file.');
  }

  metadata.characterCount = content.length;
  metadata.wordCount = content.split(/\s+/).filter(Boolean).length;

  log.info('Document parsed successfully', {
    fileName,
    characters: metadata.characterCount,
    words: metadata.wordCount,
  });

  return { content, metadata };
}

/**
 * Parse plain text content
 */
function parseText(buffer) {
  return buffer.toString('utf-8');
}

/**
 * Strip HTML tags and extract text content
 */
function parseHTML(buffer) {
  const html = buffer.toString('utf-8');
  // Remove script and style elements
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Replace block elements with newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br\s*\/?)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  // Remove remaining tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  return text;
}

/**
 * Parse JSON and convert to readable text
 */
function parseJSON(buffer) {
  try {
    const data = JSON.parse(buffer.toString('utf-8'));
    return jsonToText(data);
  } catch {
    return buffer.toString('utf-8');
  }
}

function jsonToText(obj, prefix = '') {
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    return obj.map((item, i) => jsonToText(item, `${prefix}[${i}]`)).join('\n');
  }
  if (obj && typeof obj === 'object') {
    return Object.entries(obj)
      .map(([key, val]) => {
        const label = prefix ? `${prefix}.${key}` : key;
        const text = jsonToText(val, label);
        return typeof val === 'object' ? `${label}:\n${text}` : `${label}: ${text}`;
      })
      .join('\n');
  }
  return '';
}

/**
 * Attempt to extract text from PDF.
 * Uses pdf-parse if available, otherwise returns basic extraction.
 */
async function parsePDF(buffer) {
  try {
    // Try to use pdf-parse (optional dependency)
    const pdfParse = await import('pdf-parse/lib/pdf-parse.js').catch(() => null);
    if (pdfParse) {
      const result = await pdfParse.default(buffer);
      return result.text;
    }
  } catch (err) {
    log.warn('pdf-parse failed, attempting basic extraction', { error: err.message });
  }

  // Basic extraction fallback — look for text streams in PDF
  const text = buffer.toString('utf-8');
  const textBlocks = [];
  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
  let match;
  while ((match = streamRegex.exec(text)) !== null) {
    const block = match[1]
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/[^\x20-\x7E\n\t]/g, '')
      .trim();
    if (block.length > 20) {
      textBlocks.push(block);
    }
  }

  if (textBlocks.length === 0) {
    // Try extracting parenthesized text objects
    const tjRegex = /\(([^)]+)\)/g;
    while ((match = tjRegex.exec(text)) !== null) {
      if (match[1].length > 3) {
        textBlocks.push(match[1]);
      }
    }
  }

  if (textBlocks.length === 0) {
    throw new Error(
      'Could not extract text from PDF. Install pdf-parse for better PDF support: npm install pdf-parse'
    );
  }

  return textBlocks.join('\n');
}

/**
 * Attempt to extract text from DOCX.
 * DOCX files are ZIP archives containing XML.
 */
async function parseDOCX(buffer) {
  try {
    // Try mammoth (optional dependency)
    const mammoth = await import('mammoth').catch(() => null);
    if (mammoth) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
  } catch (err) {
    log.warn('mammoth failed, attempting basic DOCX extraction', { error: err.message });
  }

  // Basic DOCX fallback — DOCX is XML in a ZIP. Extract <w:t> text elements.
  try {
    const { Readable } = await import('stream');
    const { createInflateRaw } = await import('zlib');
    // Look for XML text tags in raw content
    const raw = buffer.toString('utf-8');
    const textParts = [];
    const tagRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
    let m;
    while ((m = tagRegex.exec(raw)) !== null) {
      textParts.push(m[1]);
    }
    if (textParts.length > 0) {
      return textParts.join(' ');
    }
  } catch (err) {
    log.warn('Basic DOCX extraction failed', { error: err.message });
  }

  throw new Error(
    'Could not extract text from DOCX. Install mammoth for better DOCX support: npm install mammoth'
  );
}

/**
 * Clean extracted text — normalize whitespace, remove control chars
 */
function cleanText(text) {
  if (!text) return '';
  // Remove null bytes and non-printable chars except newline/tab
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Collapse multiple blank lines to max 2
  text = text.replace(/\n{3,}/g, '\n\n');
  // Collapse multiple spaces
  text = text.replace(/ {2,}/g, ' ');
  // Trim each line
  text = text
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
  return text.trim();
}

/**
 * Determine MIME type from file extension
 */
export function getMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const mimeMap = {
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.md': 'text/markdown',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.json': 'application/json',
  };
  return mimeMap[ext] || null;
}

/**
 * Check if a MIME type is supported
 */
export function isSupportedType(mimeType) {
  return mimeType in SUPPORTED_TYPES;
}

/**
 * Get list of supported file extensions
 */
export function getSupportedExtensions() {
  return ['.txt', '.csv', '.md', '.html', '.pdf', '.docx', '.json'];
}
