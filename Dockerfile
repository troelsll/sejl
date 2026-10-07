FROM node:24-slim
ADD https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.tar.gz /tmp/ls.tgz
RUN tar -xzf /tmp/ls.tgz -C /usr/local/bin litestream && rm /tmp/ls.tgz
WORKDIR /app
COPY . .
ENV PORT=8080 DATA_DIR=/data
EXPOSE 8080
CMD ["/app/start.sh"]
