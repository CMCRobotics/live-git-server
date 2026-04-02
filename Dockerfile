# Use the official Bun image
FROM oven/bun:1.1

# Install git (required for git http-backend)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and lockfile (if it exists)
COPY package.json ./
# COPY bun.lockb ./

# Install dependencies
RUN bun install

# Copy source code
COPY server.ts ./

# Create directories for repositories and live files
RUN mkdir -p /app/repos /app/live

# Expose the server port
EXPOSE 3000

# Start the server
CMD ["bun", "run", "server.ts"]
