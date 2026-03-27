// src/services/ipfsCache.service.ts
import axios from 'axios';

export async function fetchAndCacheMetadata(projectId: number, cid: string) {
  const url = `https://ipfs.io/ipfs/${cid}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MyNovaApp/1.0)',
        Accept: 'application/json',
      },
      timeout: 5000,
    });

    console.log(`IPFS Cron: Successfully fetched metadata for project ${projectId}`);
    
    // TODO: Cache the metadata in your DB
    const metadata = response.data;
    return metadata;

  } catch (error: any) {
    if (error.response && error.response.status === 403) {
      console.warn(`IPFS Cron: 403 Forbidden for project ${projectId}, using dummy data.`);
      
      // Dummy fallback metadata for testing
      const dummyMetadata = {
        name: `Project ${projectId} (dummy)`,
        description: 'This is placeholder metadata for local testing.',
        image: 'https://via.placeholder.com/150',
      };

      return dummyMetadata;
    }

    console.error(`IPFS Cron: Failed to fetch IPFS metadata for project ${projectId}:`, error.message);
    return null; // or throw if you want to handle it elsewhere
  }
}