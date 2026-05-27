FROM node:22-alpine

RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    curl \
    bash

RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir yt-dlp
ENV PATH="/opt/venv/bin:$PATH"


WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN yt-dlp --version && ffmpeg -version | head -1

EXPOSE 3000
CMD ["npm", "start"]