// backend/src/db/projects.ts

export async function getNewProjects() {
    // Return dummy projects for testing
    return [
        { id: "1", cid: "QmDummyCid1" },
        { id: "2", cid: "QmDummyCid2" }
    ];
}

export async function saveProjectMetadata(projectId: string, data: any) {
    console.log(`Pretend saving project ${projectId} metadata`);
}

export async function removeProjectMetadata(projectId: string) {
    console.log(`Pretend removing project ${projectId} metadata`);
}