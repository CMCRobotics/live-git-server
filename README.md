# 🚀 Live Git Server

A trivial but powerful Git server built with **Bun.js** to host and visualize live static web pages instantly! Perfect for educational environments, rapid prototyping, or children learning to code. 🎨✨

## ✨ Features

- **📂 Auto-Initializing Repos**: Just push to a new URL, and the server creates the repo on-the-fly!
- **🌐 Smart HTTP Git**: Full support for `git push` and `git pull` over HTTP.
- **⚡ Live Preview**: Files are automatically checked out into a `live/` folder after every push.
- **🔒 Protected**: Optional `SECRET_TOKEN` protection to keep your projects safe.
- **🐳 Docker Ready**: Comes with a Dockerfile for easy deployment.
- **🤖 CI/CD**: Integrated with GitHub Actions and GHCR.

## 🚀 Getting Started

### 1. Run with Bun
```bash
# Install dependencies
bun install

# Start the server
SECRET_TOKEN=my-super-secret-token bun run server.ts
```

### 2. Run with Docker
```bash
docker pull ghcr.io/cmcrobotics/live-git-server:latest
docker run -p 3000:3000 \
  -e SECRET_TOKEN=your_secret \
  -v $(pwd)/repos:/app/repos \
  -v $(pwd)/live:/app/live \
  ghcr.io/cmcrobotics/live-git-server:latest
```

## 🛠 Usage

### Push your project
```bash
# Add the remote (replace alice and my-project with your names)
git remote add origin http://localhost:3000/git/alice/my-project.git?token=my-super-secret-token

# Push!
git push origin main
```

### View it live!
Open your browser and head to:
`http://localhost:3000/live/alice/my-project/index.html` 🌍

## ⚙️ Configuration

| Env Var | Description | Default |
|---------|-------------|---------|
| `PORT` | Server port | `3000` |
| `SECRET_TOKEN` | Optional token for Git operations | `undefined` (No protection) |

## 🧪 Testing
```bash
bun test
```

---
Made with ❤️ for young creators! 🌈
