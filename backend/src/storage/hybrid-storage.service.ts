import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { create } from 'ipfs-http-client';
import * as CryptoJS from 'crypto-js';
import { Readable } from 'stream';

export interface StorageResult {
  s3Key?: string;
  ipfsHash?: string;
  encrypted: boolean;
  timestamp: Date;
}

export interface DocumentMetadata {
  projectId: string;
  documentType: string;
  fileName: string;
  contentType: string;
  size: number;
  s3Key?: string;
  ipfsHash?: string;
  encrypted: boolean;
}

/**
 * Hybrid Storage Service combining S3 and IPFS
 * 
 * Strategy:
 * - S3: Fast, encrypted storage for immediate access
 * - IPFS: Decentralized, immutable backup for long-term preservation
 * 
 * Benefits:
 * - Fast document viewing for authenticated users (S3)
 * - Immutable backup on IPFS for decentralization
 * - Encryption at rest for sensitive documents
 */
@Injectable()
export class HybridStorageService {
  private readonly logger = new Logger(HybridStorageService.name);
  private readonly s3Client: S3Client;
  private readonly ipfsClient: ReturnType<typeof create>;
  private readonly bucketName: string;
  private readonly encryptionKey: string;
  private readonly enableIPFS: boolean;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET', 'novafund-docs');
    this.encryptionKey = this.configService.get<string>('DOCUMENT_ENCRYPTION_KEY', 'default-key-change-in-production');
    this.enableIPFS = this.configService.get<string>('ENABLE_IPFS_PINNING', 'true') === 'true';

    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });

    // Initialize IPFS client
    const ipfsUrl = this.configService.get<string>('IPFS_API_URL', 'http://localhost:5001');
    this.ipfsClient = create({
      host: ipfsUrl,
      port: 5001,
      protocol: 'http',
    });

    this.logger.log(`Hybrid storage initialized: S3 bucket=${this.bucketName}, IPFS=${this.enableIPFS}`);
  }

  /**
   * Upload document with hybrid storage strategy
   * 1. Encrypt and upload to S3 for fast access
   * 2. Pin to IPFS for decentralized backup (async)
   */
  async uploadDocument(
    file: Buffer,
    metadata: DocumentMetadata,
  ): Promise<StorageResult> {
    const timestamp = new Date();
    const s3Key = this.generateS3Key(metadata);
    
    try {
      // Step 1: Encrypt the document
      const encryptedData = this.encryptData(file);
      
      // Step 2: Upload to S3 (fast, encrypted)
      await this.uploadToS3(s3Key, encryptedData, metadata);
      this.logger.log(`Document uploaded to S3: ${s3Key}`);

      // Step 3: Upload to IPFS (async, for backup)
      let ipfsHash: string | undefined;
      if (this.enableIPFS) {
        try {
          ipfsHash = await this.uploadToIPFS(file, metadata);
          this.logger.log(`Document pinned to IPFS: ${ipfsHash}`);
        } catch (error) {
          this.logger.warn(`IPFS upload failed, but S3 succeeded: ${error.message}`);
          // Don't fail the operation if IPFS fails
        }
      }

      const result: StorageResult = {
        s3Key,
        ipfsHash,
        encrypted: true,
        timestamp,
      };

      return result;
    } catch (error) {
      this.logger.error(`Document upload failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve document from S3 (fast access)
   * Decrypts the document before returning
   */
  async getDocument(s3Key: string): Promise<Buffer> {
    try {
      // Download from S3
      const encryptedData = await this.downloadFromS3(s3Key);
      
      // Decrypt the document
      const decryptedData = this.decryptData(encryptedData);
      
      return decryptedData;
    } catch (error) {
      this.logger.error(`Failed to retrieve document ${s3Key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate a presigned URL for direct S3 access
   * Useful for frontend downloads without proxying through backend
   */
  async getPresignedUrl(
    s3Key: string,
    expiresIn: number = 3600, // 1 hour default
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return url;
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve document from IPFS (for verification or backup)
   */
  async getFromIPFS(ipfsHash: string): Promise<Buffer> {
    try {
      const chunks: Uint8Array[] = [];
      for await (const chunk of this.ipfsClient.cat(ipfsHash)) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error(`Failed to retrieve from IPFS ${ipfsHash}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete document from both S3 and IPFS
   */
  async deleteDocument(s3Key: string, ipfsHash?: string): Promise<void> {
    try {
      // Delete from S3
      await this.deleteFromS3(s3Key);
      this.logger.log(`Document deleted from S3: ${s3Key}`);

      // Note: IPFS data cannot be truly deleted (immutable),
      // but we can unpin it to allow garbage collection
      if (ipfsHash) {
        try {
          await this.ipfsClient.pin.rm(ipfsHash);
          this.logger.log(`Document unpinned from IPFS: ${ipfsHash}`);
        } catch (error) {
          this.logger.warn(`Failed to unpin from IPFS: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to delete document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify document integrity by comparing S3 and IPFS hashes
   */
  async verifyDocumentIntegrity(s3Key: string, ipfsHash: string): Promise<boolean> {
    try {
      const s3Data = await this.downloadFromS3(s3Key);
      const ipfsData = await this.getFromIPFS(ipfsHash);

      // Compare hashes
      const s3Hash = CryptoJS.SHA256(CryptoJS.enc.Base64.stringify(CryptoJS.enc.Latin1.parse(s3Data.toString('base64')))).toString();
      const ipfsHashComputed = CryptoJS.SHA256(CryptoJS.enc.Base64.stringify(CryptoJS.enc.Latin1.parse(ipfsData.toString('base64')))).toString();

      return s3Hash === ipfsHashComputed;
    } catch (error) {
      this.logger.error(`Integrity verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Encrypt data using AES encryption
   */
  private encryptData(data: Buffer): Buffer {
    const encrypted = CryptoJS.AES.encrypt(
      data.toString('base64'),
      this.encryptionKey,
    );
    return Buffer.from(encrypted.toString());
  }

  /**
   * Decrypt data using AES decryption
   */
  private decryptData(encryptedData: Buffer): Buffer {
    const decrypted = CryptoJS.AES.decrypt(
      encryptedData.toString('utf8'),
      this.encryptionKey,
    );
    return Buffer.from(decrypted.toString(CryptoJS.enc.Base64), 'base64');
  }

  /**
   * Upload encrypted data to S3
   */
  private async uploadToS3(
    key: string,
    data: Buffer,
    metadata: DocumentMetadata,
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: data,
      ContentType: metadata.contentType,
      Metadata: {
        'x-project-id': metadata.projectId,
        'x-document-type': metadata.documentType,
        'x-file-name': metadata.fileName,
        'x-encrypted': 'true',
        'x-upload-date': new Date().toISOString(),
      },
    });

    await this.s3Client.send(command);
  }

  /**
   * Download encrypted data from S3
   */
  private async downloadFromS3(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('Empty response from S3');
    }

    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  /**
   * Delete from S3
   */
  private async deleteFromS3(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  /**
   * Upload to IPFS and pin for persistence
   */
  private async uploadToIPFS(data: Buffer, metadata: DocumentMetadata): Promise<string> {
    const result = await this.ipfsClient.add(data, {
      pin: true,
    });

    // Pin explicitly for long-term storage
    await this.ipfsClient.pin.add(result.cid);

    return result.cid.toString();
  }

  /**
   * Generate S3 key with project organization
   */
  private generateS3Key(metadata: DocumentMetadata): string {
    const timestamp = Date.now();
    const sanitizedFileName = metadata.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `projects/${metadata.projectId}/${metadata.documentType}/${timestamp}_${sanitizedFileName}`;
  }

  /**
   * Batch upload multiple documents (e.g., for project documentation packages)
   */
  async batchUploadDocuments(
    documents: Array<{ file: Buffer; metadata: DocumentMetadata }>,
  ): Promise<StorageResult[]> {
    const results: StorageResult[] = [];

    for (const doc of documents) {
      const result = await this.uploadDocument(doc.file, doc.metadata);
      results.push(result);
    }

    return results;
  }

  /**
   * Migrate existing S3 documents to IPFS (one-time migration)
   */
  async migrateToIPFS(documents: Array<{ s3Key: string; ipfsHash?: string }>): Promise<void> {
    for (const doc of documents) {
      if (doc.ipfsHash) {
        this.logger.log(`Document ${doc.s3Key} already has IPFS hash, skipping`);
        continue;
      }

      try {
        const s3Data = await this.getDocument(doc.s3Key);
        const ipfsHash = await this.uploadToIPFS(s3Data, {
          projectId: 'migration',
          documentType: 'migration',
          fileName: doc.s3Key,
          contentType: 'application/octet-stream',
          size: s3Data.length,
          encrypted: false,
        });

        this.logger.log(`Migrated ${doc.s3Key} to IPFS: ${ipfsHash}`);
      } catch (error) {
        this.logger.error(`Failed to migrate ${doc.s3Key}: ${error.message}`);
      }
    }
  }
}
