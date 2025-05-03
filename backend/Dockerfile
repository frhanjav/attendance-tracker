FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./


RUN echo "----> Installing all dependencies..." && \
    npm ci && \
    echo "----> Dependencies installed."


COPY prisma ./prisma/

RUN echo "----> Generating Prisma Client..." && \
    npx prisma generate && \
    echo "----> Prisma Client generated."

COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev"]