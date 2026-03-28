import axios from 'axios';

const GATEWAYS = [
  'https://ipfs.io/ipfs',
  'https://cloudflare-ipfs.com/ipfs',
  'https://gateway.pinata.cloud/ipfs',
  'https://dweb.link/ipfs',
  'https://4everland.io/ipfs',
];

const TIMEOUT_MS = 3000;

export async function fetchFromIPFS(cid: string): Promise<any> {
  let lastError: Error | null = null;

  for (const gateway of GATEWAYS) {
    try {
      const response = await axios.get(`${gateway}/${cid}`, {
        timeout: TIMEOUT_MS,
        headers: { Accept: 'application/json' },
      });
      return response.data;
    } catch (error: any) {
      const status = error.response?.status;
      const isFailover = !status || status === 504 || error.code === 'ECONNABORTED';

      if (isFailover) {
        lastError = error;
        continue; // try next gateway
      }

      throw error; // non-timeout errors (e.g. 403, 404) bubble up immediately
    }
  }

  throw lastError ?? new Error(`All IPFS gateways failed for CID: ${cid}`);
}
