FROM node:22-alpine

# Install system deps
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    curl \
    unzip \
    bash

# Install yt-dlp
RUN pip3 install yt-dlp --break-system-packages

# Install Deno
RUN curl -fsSL https://deno.land/install.sh | sh && \
    mv /root/.deno/bin/deno /usr/local/bin/deno

# Verify tools
RUN yt-dlp --version && \
    ffmpeg -version | head -1 && \
    deno --version

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]