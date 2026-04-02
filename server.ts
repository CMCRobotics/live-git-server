import { spawn } from "bun";
import { join } from "node:path";
import { mkdir, chmod, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const REPOS_DIR = join(process.cwd(), "repos");
const LIVE_DIR = join(process.cwd(), "live");
const SECRET_TOKEN = process.env.SECRET_TOKEN;

async function ensureRepo(user: string, project: string) {
  const repoPath = join(REPOS_DIR, user, `${project}.git`);
  const livePath = join(LIVE_DIR, user, project);

  if (!existsSync(repoPath)) {
    console.log(`Initializing new repo: ${repoPath}`);
    await mkdir(join(REPOS_DIR, user), { recursive: true });
    
    // Init bare repo
    const init = spawn(["git", "init", "--bare", repoPath]);
    await init.exited;

    // Allow HTTP pushes
    const config = spawn(["git", "-C", repoPath, "config", "http.receivepack", "true"]);
    await config.exited;

    // Create post-receive hook
    const hookPath = join(repoPath, "hooks", "post-receive");
    const hookContent = `#!/bin/bash
mkdir -p "${livePath}"
git --work-tree="${livePath}" --git-dir="." checkout -f
`;
    await writeFile(hookPath, hookContent);
    await chmod(hookPath, 0o755);
  }
  return repoPath;
}

export const serverOptions = {
  port: process.env.PORT || 3000,
  async fetch(req: Request) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Handle Git HTTP Backend
    if (path.startsWith("/git/")) {
      // Secret Token Protection
      if (SECRET_TOKEN) {
        const authHeader = req.headers.get("authorization");
        const urlToken = url.searchParams.get("token");
        const token = urlToken || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);

        if (token !== SECRET_TOKEN) {
          return new Response("Unauthorized: Invalid Secret Token", { status: 401 });
        }
      }

      const parts = path.slice(5).split("/");
      if (parts.length < 2) return new Response("Invalid git path", { status: 400 });

      const user = parts[0];
      const projectWithGit = parts[1];
      const project = projectWithGit.endsWith(".git") ? projectWithGit.slice(0, -4) : projectWithGit;
      const subPath = "/" + parts.slice(2).join("/");

      const repoPath = await ensureRepo(user, project);

      // GIT_PROJECT_ROOT is the base directory for repos
      // PATH_INFO is the relative path within the repo root
      const gitHttpBackend = "git"; // Usually in PATH
      
      const env = {
        GIT_PROJECT_ROOT: join(REPOS_DIR, user),
        GIT_HTTP_EXPORT_ALL: "1",
        PATH_INFO: subPath === "/" ? `/${project}.git` : `/${project}.git${subPath}`,
        REMOTE_USER: user, // Simplified auth as requested
        REQUEST_METHOD: req.method,
        QUERY_STRING: url.search.slice(1),
        CONTENT_TYPE: req.headers.get("content-type") || "",
      };

      console.log(`Git Request: ${req.method} ${path} -> ${env.PATH_INFO}`);

      const requestBody = await req.arrayBuffer();
      const proc = spawn(["git", "http-backend"], {
        env: { ...process.env, ...env },
        stdin: new Uint8Array(requestBody),
      });

      const stdout = await new Response(proc.stdout).arrayBuffer();
      const stderr = await new Response(proc.stderr).text();
      
      if (stderr) console.error("Git Stderr:", stderr);

      // git-http-backend output includes HTTP headers. We need to parse them.
      const responseBuffer = Buffer.from(stdout);
      const headerEndIndex = responseBuffer.indexOf("\r\n\r\n");
      
      if (headerEndIndex === -1) {
          // Fallback if no double CRLF found
          return new Response(stdout);
      }

      const headerString = responseBuffer.subarray(0, headerEndIndex).toString();
      const body = responseBuffer.subarray(headerEndIndex + 4);
      
      const headers = new Headers();
      let status = 200;

      headerString.split("\r\n").forEach(line => {
        const [key, ...values] = line.split(": ");
        const value = values.join(": ");
        if (key.toLowerCase() === "status") {
          status = parseInt(value) || 200;
        } else if (key) {
          headers.set(key, value);
        }
      });

      return new Response(body, { status, headers });
    }

    // Handle Static File Serving
    if (path.startsWith("/live/")) {
      const relativePath = path.slice(6);
      const filePath = join(LIVE_DIR, relativePath);
      
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file);
      }
      return new Response("Not Found", { status: 404 });
    }

    return new Response("Git Server Running", { status: 200 });
  },
};

if (import.meta.main) {
  const server = Bun.serve(serverOptions);
  console.log(`Server running at http://localhost:${server.port}`);
}
