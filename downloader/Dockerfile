FROM node:22-alpine

# Install ffmpeg, python3, pip
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip

# Install yt-dlp via pip
RUN pip3 install yt-dlp --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN yt-dlp --version && ffmpeg -version | head -1

EXPOSE 3000
CMD ["npm", "start"]