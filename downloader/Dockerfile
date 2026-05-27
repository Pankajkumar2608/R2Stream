FROM node:22-alpine

# Install system deps
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    curl \
    bash

# Install yt-dlp via pip
RUN pip3 install yt-dlp --break-system-packages

# Install Deno (JS runtime required by yt-dlp for YouTube extraction)
RUN curl -fsSL https://deno.land/install.sh | bash
ENV DENO_INSTALL="/root/.deno"
ENV PATH="${DENO_INSTALL}/bin:${PATH}"

# Verify tools
RUN yt-dlp --version && ffmpeg -version | head -1 && deno --version

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000
CMD ["npm", "start"]