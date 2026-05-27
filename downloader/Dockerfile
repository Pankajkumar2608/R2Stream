FROM node:22-slim

# Install yt-dlp and ffmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    --no-install-recommends && \
    # Install latest yt-dlp binary
    curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp && \
    # Cleanup
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Verify tools
RUN yt-dlp --version && ffmpeg -version | head -1

EXPOSE 3000

CMD ["npm", "start"]