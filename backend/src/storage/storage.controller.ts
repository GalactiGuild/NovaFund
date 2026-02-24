import { Controller, Post, Body } from '@nestjs/common';
import { StorageService } from './storage.service';

@Controller('projects')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('metadata')
  async pinProjectMetadata(@Body() metadata: any): Promise<string> {
    return this.storageService.pinProjectMetadata(metadata);
  }

  @Post('banner')
  async optimizeAndUploadBanner(@Body() banner: any): Promise<string> {
    const optimizedImage = await this.storageService.optimizeImage(banner.imagePath, banner.width, banner.height);
    const cid = await this.storageService.pinProjectMetadata({ image: optimizedImage });
    return cid;
  }

  @Post('verify-hash')
  async verifyIPFSHash(@Body('hash') hash: string): Promise<boolean> {
    return this.storageService.verifyIPFSHash(hash);
  }
}