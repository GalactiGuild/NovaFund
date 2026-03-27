// src/jobs/ipfsCron.job.ts

// Simulated fetch function
async function fetchAndCacheMetadata(projectId: number, cid: string) {
  return {
    name: `Project ${projectId}`,
    description: `Metadata for CID ${cid}`,
    cid,
  };
}

// Example projects
const projects = [
  { id: 1, cid: 'QmDummyCid1' },
  { id: 2, cid: 'QmDummyCid2' },
  { id: 3, cid: 'QmDummyCid3' },
];

async function ipfsCronJob() {
  console.log('IPFS Cron: Checking for new projects to cache...');

  for (const project of projects) {
    try {
      const metadata = await fetchAndCacheMetadata(project.id, project.cid);

      if (metadata) {
        console.log(`IPFS Cron: Cached metadata for project ${project.id}:`, metadata);
      } else {
        console.warn(`IPFS Cron: No metadata returned for project ${project.id}`);
      }
    } catch (err) {
      console.error(`IPFS Cron: Unexpected error for project ${project.id}:`, err);
    }
  }

  console.log('IPFS Cron: Finished checking all projects.');
}

// Run immediately for testing
ipfsCronJob();