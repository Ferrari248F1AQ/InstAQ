FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8472 HOST=0.0.0.0 DATA_DIR=/data
VOLUME /data
EXPOSE 8472
HEALTHCHECK CMD node -e "fetch('http://localhost:8472/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--no-warnings", "server.js"]
