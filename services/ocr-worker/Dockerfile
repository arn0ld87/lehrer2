# OCR-Worker-Container
# Node-Basis + tesseract-ocr (deu) + poppler-utils (pdftoppm)
# Schlank: kein Next.js-Build, nur Worker-Entrypoint

FROM node:20-slim

# System-Abhängigkeiten: tesseract + Deutsch-Sprache + poppler (pdftoppm)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-deu \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# pnpm aktivieren
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

# Abhängigkeiten separat kopieren (Layer-Cache)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Quellcode kopieren (nur was der Worker benötigt)
COPY src/ ./src/
COPY worker/ ./worker/
COPY tsconfig.json ./

# Worker starten (tsx für TypeScript-Direktausführung)
ENV OCR_WORKER_AUTOSTART=1
CMD ["pnpm", "exec", "tsx", "worker/ocr-worker.ts"]
