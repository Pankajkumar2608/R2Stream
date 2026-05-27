FROM node:22-alpine

# Install dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    curl \
    bash

# Install yt-dlp
RUN pip3 install yt-dlp

# Install Deno (official Alpine package)
RUN apk add --no-cache deno

# Verify installs
RUN yt-dlp --version && \
    ffmpeg -version | head -1 && \
    deno --version

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]