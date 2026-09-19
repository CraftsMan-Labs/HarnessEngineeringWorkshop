FROM node:22-slim

# bubblewrap backs dsh's local sandbox on Linux (workspace-write mode);
# git is needed by profile/plugin installs.
RUN apt-get update \
  && apt-get install -y --no-install-recommends bubblewrap ca-certificates git \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g @deepseek-ai/dsh

# node:22-slim already ships a UID-1000 "node" user; reuse it as dsh's owner.
ENV DSH_HOME=/home/node/.dsh
RUN mkdir -p /workspace "$DSH_HOME" \
  && chown -R node:node /workspace "$DSH_HOME"

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER node
WORKDIR /workspace

EXPOSE 3080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["web", "--no-open"]
