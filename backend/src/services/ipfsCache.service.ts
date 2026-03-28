// src/services/ipfsCache.service.ts
import { fetchFromIPFS } from '../utils/ipfsGateway';

export async function fetchAndCacheMetadata(projectId: number, cid: string) {
  try {
    const metadata = await fetchFromIPFS(cid);
    console.log(`IPFS Cron: Successfully fetched metadata for project ${projectId}`);
    // TODO: Cache the metadata in your DB
    return metadata;
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.warn(`IPFS Cron: 403 Forbidden for project ${projectId}, using dummy data.`);
      return {
        name: `Project ${projectId} (dummy)`,
        description: 'This is placeholder metadata for local testing.',
        image: 'https://via.placeholder.com/150',
      };
    }

    console.error(`IPFS Cron: Failed to fetch IPFS metadata for project ${projectId}:`, error.message);
    return null;
  }
}