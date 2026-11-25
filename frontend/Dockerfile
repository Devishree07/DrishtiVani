FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_DEMO_MODE=false
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_DIAGRAM_API_URL=http://localhost:8001
ARG NEXT_PUBLIC_TRANSCRIPTION_API_URL=http://localhost:8002
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DIAGRAM_API_URL=$NEXT_PUBLIC_DIAGRAM_API_URL
ENV NEXT_PUBLIC_TRANSCRIPTION_API_URL=$NEXT_PUBLIC_TRANSCRIPTION_API_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "run", "start"]
