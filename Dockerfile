FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=47213 HOST=0.0.0.0 DATA_DIR=/data
VOLUME /data
EXPOSE 47213
HEALTHCHECK CMD node -e "fetch('http://localhost:47213/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--no-warnings", "server.js"]
