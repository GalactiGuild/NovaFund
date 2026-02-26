import { Injectable } from '@nestjs/common';
import { create } from 'ipfs-http-client';

import sharp from 'sharp';

@Injectable()
export class StorageService {
  private ipfs: ReturnType<typeof create>;

  constructor() {
    this.ipfs = create({
      host: 'your-ipfs-provider-url',
      port: 5000,
    });
  }

  async pinProjectMetadata(metadata: any): Promise<string> {
    const cid = await this.ipfs.add(metadata);
    return cid.path;
  }

  async optimizeImage(imagePath: string, width: number, height: number): Promise<Buffer> {
    const optimizedImage = await sharp(imagePath)
      .resize(width, height)
      .jpeg({ quality: 80 })
      .toBuffer();
    return optimizedImage;
  }

  async verifyIPFSHash(hash: string): Promise<boolean> {
    try {
      await this.ipfs.cat(hash);
      return true;
    } catch (error) {
      return false;
    }
  }
}
