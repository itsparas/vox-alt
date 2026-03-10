/**
 * Storage Service
 * Handles file storage operations for recordings and other files
 * Supports local filesystem for development and S3 for production
 */

import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../config/index.js';
import { logger } from '../lib/logger.js';

const log = logger.child({ service: 'storage' });

// Local storage directory for development
const LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || '/tmp/voxreception-storage';

// S3 Client (initialized lazily)
let s3Client = null;

function getS3Client() {
  if (!s3Client && config.s3?.accessKeyId) {
    s3Client = new S3Client({
      region: config.s3.region || 'us-east-1',
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });
  }
  return s3Client;
}

/**
 * Check if using S3 storage
 */
function useS3() {
  return !!config.s3?.accessKeyId && !!config.s3?.bucket;
}

/**
 * Ensure local storage directory exists
 */
async function ensureLocalDir() {
  await fs.mkdir(LOCAL_STORAGE_DIR, { recursive: true });
}

/**
 * Upload a file to storage
 * @param {Buffer|ReadableStream} data - File data
 * @param {string} key - Storage key/path
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<{bucket: string, key: string, size: number}>}
 */
export async function uploadFile(data, key, mimeType = 'application/octet-stream') {
  if (useS3()) {
    return uploadToS3(data, key, mimeType);
  }
  return uploadToLocal(data, key, mimeType);
}

async function uploadToS3(data, key, mimeType) {
  const client = getS3Client();
  const bucket = config.s3.bucket;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: data,
    ContentType: mimeType,
  });

  await client.send(command);

  // Get file size
  const headCommand = new HeadObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  const head = await client.send(headCommand);

  log.info('File uploaded to S3', { bucket, key, size: head.ContentLength });

  return {
    bucket,
    key,
    size: head.ContentLength,
  };
}

async function uploadToLocal(data, key, mimeType) {
  await ensureLocalDir();
  const filePath = path.join(LOCAL_STORAGE_DIR, key);
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  
  // Write file
  if (Buffer.isBuffer(data)) {
    await fs.writeFile(filePath, data);
  } else {
    const writeStream = createWriteStream(filePath);
    await pipeline(data, writeStream);
  }

  const stats = await fs.stat(filePath);

  log.info('File uploaded to local storage', { path: filePath, size: stats.size });

  return {
    bucket: 'local',
    key,
    size: stats.size,
  };
}

/**
 * Get a signed URL for downloading a file
 * @param {string} key - Storage key/path
 * @param {string} bucket - Storage bucket
 * @param {number} expiresIn - URL expiration in seconds (default: 3600)
 * @returns {Promise<string>} Signed URL
 */
export async function getDownloadUrl(key, bucket, expiresIn = 3600) {
  if (useS3() && bucket !== 'local') {
    return getS3DownloadUrl(key, bucket, expiresIn);
  }
  return getLocalDownloadUrl(key);
}

async function getS3DownloadUrl(key, bucket, expiresIn) {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return url;
}

async function getLocalDownloadUrl(key) {
  // For local storage, return a relative URL that will be served by the API
  return `/api/storage/download/${encodeURIComponent(key)}`;
}

/**
 * Get file as a readable stream
 * @param {string} key - Storage key/path
 * @param {string} bucket - Storage bucket
 * @returns {Promise<ReadableStream>}
 */
export async function getFileStream(key, bucket) {
  if (useS3() && bucket !== 'local') {
    return getS3FileStream(key, bucket);
  }
  return getLocalFileStream(key);
}

async function getS3FileStream(key, bucket) {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await client.send(command);
  return response.Body;
}

async function getLocalFileStream(key) {
  const filePath = path.join(LOCAL_STORAGE_DIR, key);
  return createReadStream(filePath);
}

/**
 * Delete a file from storage
 * @param {string} key - Storage key/path
 * @param {string} bucket - Storage bucket
 */
export async function deleteFile(key, bucket) {
  if (useS3() && bucket !== 'local') {
    return deleteFromS3(key, bucket);
  }
  return deleteFromLocal(key);
}

async function deleteFromS3(key, bucket) {
  const client = getS3Client();

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await client.send(command);
  log.info('File deleted from S3', { bucket, key });
}

async function deleteFromLocal(key) {
  const filePath = path.join(LOCAL_STORAGE_DIR, key);
  await fs.unlink(filePath);
  log.info('File deleted from local storage', { path: filePath });
}

/**
 * Check if a file exists
 * @param {string} key - Storage key/path
 * @param {string} bucket - Storage bucket
 * @returns {Promise<boolean>}
 */
export async function fileExists(key, bucket) {
  if (useS3() && bucket !== 'local') {
    return s3FileExists(key, bucket);
  }
  return localFileExists(key);
}

async function s3FileExists(key, bucket) {
  try {
    const client = getS3Client();
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

async function localFileExists(key) {
  try {
    const filePath = path.join(LOCAL_STORAGE_DIR, key);
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export default {
  uploadFile,
  getDownloadUrl,
  getFileStream,
  deleteFile,
  fileExists,
};
