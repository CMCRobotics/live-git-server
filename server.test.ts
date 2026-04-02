import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { join } from "node:path";
import { rm, mkdir, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { serverOptions } from "./server";

const TEST_DIR = join(process.cwd(), "test-data");
const REPOS_DIR = join(TEST_DIR, "repos");
const LIVE_DIR = join(TEST_DIR, "live");

let server: any;

describe("Git Server Logic", () => {
  beforeAll(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true });
    }
    await mkdir(REPOS_DIR, { recursive: true });
    await mkdir(LIVE_DIR, { recursive: true });

    // Start in-process server for testing
    server = Bun.serve({
        ...serverOptions,
        port: 0 // Random port
    });
  });

  afterAll(async () => {
    server?.stop();
    // Keep it for inspection if needed, or clean up
    // await rm(TEST_DIR, { recursive: true });
  });

  test("ensureRepo initializes a new bare repository", async () => {
    const user = "testuser";
    const project = "testproj";
    const repoPath = join(process.cwd(), "repos", user, `${project}.git`);
    const livePath = join(process.cwd(), "live", user, project);

    // Initial state might have it from previous manual runs, so we check existence
    // But ensureRepo is called via the fetch handler in our integration test.
    // For this unit test, let's just check the side effects of calling the handler.
    
    const url = `${server.url.origin}/git/${user}/${project}.git/info/refs?service=git-receive-pack`;
    const response = await fetch(url);
    expect(response.status).toBe(200);

    expect(existsSync(repoPath)).toBe(true);
    expect(existsSync(join(repoPath, "config"))).toBe(true);
    
    const hookPath = join(repoPath, "hooks", "post-receive");
    expect(existsSync(hookPath)).toBe(true);
    
    const hookStat = await stat(hookPath);
    expect(hookStat.mode & 0o111).toBeTruthy(); // Executable
  });

  test("Static file serving logic", async () => {
    const user = "staticuser";
    const project = "staticproj";
    const livePath = join(process.cwd(), "live", user, project);
    await mkdir(livePath, { recursive: true });
    
    const indexPath = join(livePath, "index.html");
    const content = "<h1>Test</h1>";
    await writeFile(indexPath, content);

    const url = `${server.url.origin}/live/${user}/${project}/index.html`;
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(content);
  });
});

describe("Server Integration", () => {
    test("Server responds to health check", async () => {
        const response = await fetch(server.url.origin + "/");
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("Git Server Running");
    });

    test("Git info/refs returns 200 or 401 depending on token", async () => {
        const url = `${server.url.origin}/git/bob/test-repo.git/info/refs?service=git-receive-pack`;
        const response = await fetch(url);
        
        // If server has SECRET_TOKEN it should be 401, otherwise 200
        if (process.env.SECRET_TOKEN) {
            expect(response.status).toBe(401);
            
            const authorizedResponse = await fetch(url + "&token=" + process.env.SECRET_TOKEN);
            expect(authorizedResponse.status).toBe(200);
        } else {
            expect(response.status).toBe(200);
        }
    });
});
