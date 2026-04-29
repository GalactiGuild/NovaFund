import { Controller, Post, Get, Body, Param, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { HybridStorageService, DocumentMetadata } from './hybrid-storage.service';

@Controller('storage')
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly hybridStorageService: HybridStorageService,
  ) {}

  // Legacy IPFS-only endpoints
  @Post('metadata')
  async pinProjectMetadata(@Body() metadata: any): Promise<string> {
    return this.storageService.pinProjectMetadata(metadata);
  }

  @Post('banner')
  async optimizeAndUploadBanner(@Body() banner: any): Promise<string> {
    const optimizedImage = await this.storageService.optimizeImage(
      banner.imagePath,
      banner.width,
      banner.height,
    );
    const cid = await this.storageService.pinProjectMetadata({ image: optimizedImage });
    return cid;
  }

  @Post('verify-hash')
  async verifyIPFSHash(@Body('hash') hash: string): Promise<boolean> {
    return this.storageService.verifyIPFSHash(hash);
  }

  // New hybrid storage endpoints
  @Post('document/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: any,
    @Body() metadata: Omit<DocumentMetadata, 'size'>,
  ): Promise<any> {
    const documentMetadata: DocumentMetadata = {
      ...metadata,
      size: file.size,
    };

    const result = await this.hybridStorageService.uploadDocument(
      file.buffer,
      documentMetadata,
    );

    return {
      success: true,
      data: result,
      message: 'Document uploaded with hybrid storage (S3 + IPFS)',
    };
  }

  @Get('document/:s3Key')
  async getDocument(@Param('s3Key') s3Key: string): Promise<any> {
    const document = await this.hybridStorageService.getDocument(s3Key);
    
    return {
      success: true,
      data: document.toString('base64'),
      message: 'Document retrieved successfully',
    };
  }

  @Get('document/presigned/:s3Key')
  async getPresignedUrl(
    @Param('s3Key') s3Key: string,
    @Query('expiresIn') expiresIn?: string,
  ): Promise<any> {
    const url = await this.hybridStorageService.getPresignedUrl(
      s3Key,
      expiresIn ? parseInt(expiresIn) : 3600,
    );

    return {
      success: true,
      url,
      message: 'Presigned URL generated',
    };
  }

  @Post('document/verify')
  async verifyDocumentIntegrity(
    @Body('s3Key') s3Key: string,
    @Body('ipfsHash') ipfsHash: string,
  ): Promise<any> {
    const isValid = await this.hybridStorageService.verifyDocumentIntegrity(
      s3Key,
      ipfsHash,
    );

    return {
      success: true,
      integrity: isValid,
      message: isValid ? 'Document integrity verified' : 'Document integrity check failed',
    };
  }

  @Post('document/ipfs')
  async getFromIPFS(@Body('ipfsHash') ipfsHash: string): Promise<any> {
    const document = await this.hybridStorageService.getFromIPFS(ipfsHash);

    return {
      success: true,
      data: document.toString('base64'),
      message: 'Document retrieved from IPFS',
    };
  }
}
