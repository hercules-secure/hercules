# Используем Node 20 (как раньше, всё работало)
FROM node:20-alpine

WORKDIR /app

# 1. Ставим системные библиотеки для Chromium (нужны Alpine)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# 2. Говорим puppeteer НЕ качать свой Chromium (он тяжелый и падает на Alpine)
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# 3. Говорим puppeteer использовать системный Chromium (который мы поставили выше)
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 4. Ставим зависимости
COPY package*.json ./
RUN npm ci --only=production

# 5. Копируем код
COPY . .

EXPOSE 6565
CMD ["npm", "run", "start:prod"]