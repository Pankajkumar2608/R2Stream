FROM node:22-alpine

# Install system deps
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    curl \
    unzip \
    bash

# Install yt-dlp via pip
RUN pip3 install yt-dlp --break-system-packages

# Install Deno via direct binary (Alpine needs musl build)
RUN curl -fsSL https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-musl.zip \
    -o /tmp/deno.zip && \
    unzip /tmp/deno.zip -d /usr/local/bin && \
    chmod +x /usr/local/bin/deno && \
    rm /tmp/deno.zip

# Verify tools
RUN yt-dlp --version && ffmpeg -version | head -1 && deno --version

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000
CMD ["npm", "start"]