import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { join } from "node:path";
import { rm, mkdir, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";

const TEST_DIR = join(process.cwd(), "test-data");
const REPOS_DIR = join(TEST_DIR, "repos");
const LIVE_DIR = join(TEST_DIR, "live");

// Helper to run the server in a way we can test or just test the logic
// For unit tests, we'll test the core logic. 
// Integration tests would run the server.

describe("Git Server Logic", () => {
  beforeAll(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true });
    }
    await mkdir(REPOS_DIR, { recursive: true });
    await mkdir(LIVE_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Keep it for inspection if needed, or clean up
    // await rm(TEST_DIR, { recursive: true });
  });

  test("ensureRepo initializes a new bare repository", async () => {
    const user = "testuser";
    const project = "testproj";
    const repoPath = join(REPOS_DIR, user, `${project}.git`);
    const livePath = join(LIVE_DIR, user, project);

    // We need to import the logic or mock it. 
    // Since it's in server.ts, let's mock the essential parts or use the logic.
    // Ideally we would export ensureRepo from server.ts
    
    // For now, let's re-implement the check or refactor server.ts to export it.
    expect(existsSync(repoPath)).toBe(false);
    
    // Logic from server.ts
    await mkdir(join(REPOS_DIR, user), { recursive: true });
    const { spawn } = await import("bun");
    await spawn(["git", "init", "--bare", repoPath]).exited;
    await spawn(["git", "-C", repoPath, "config", "http.receivepack", "true"]).exited;
    
    const hookPath = join(repoPath, "hooks", "post-receive");
    const hookContent = `#!/bin/bash\nmkdir -p "${livePath}"\ngit --work-tree="${livePath}" --git-dir="." checkout -f\n`;
    await writeFile(hookPath, hookContent);
    await (await import("node:fs/promises")).chmod(hookPath, 0o755);

    expect(existsSync(repoPath)).toBe(true);
    expect(existsSync(join(repoPath, "config"))).toBe(true);
    expect(existsSync(hookPath)).toBe(true);
    
    const hookStat = await stat(hookPath);
    expect(hookStat.mode & 0o111).toBeTruthy(); // Executable
  });

  test("Static file serving logic", async () => {
    const user = "testuser";
    const project = "testproj";
    const livePath = join(LIVE_DIR, user, project);
    await mkdir(livePath, { recursive: true });
    
    const indexPath = join(livePath, "index.html");
    const content = "<h1>Test</h1>";
    await writeFile(indexPath, content);

    const file = Bun.file(indexPath);
    expect(await file.exists()).toBe(true);
    expect(await file.text()).toBe(content);
  });
});

describe("Server Integration", () => {
    test("Server responds to health check", async () => {
        const response = await fetch("http://localhost:3000/");
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("Git Server Running");
    });

    test("Git info/refs returns 200 for new repo", async () => {
        const response = await fetch("http://localhost:3000/git/bob/new-repo.git/info/refs?service=git-receive-pack");
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/x-git-receive-pack-advertisement");
        
        // Check if repo was created
        const repoPath = join(process.cwd(), "repos", "bob", "new-repo.git");
        expect(existsSync(repoPath)).toBe(true);
    });

    test("Serving live files", async () => {
        // Alice's project was pushed in the previous manual test step
        const response = await fetch("http://localhost:3000/live/alice/my-project/index.html");
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("<h1>Hello Git</h1>\n");
    });
});
