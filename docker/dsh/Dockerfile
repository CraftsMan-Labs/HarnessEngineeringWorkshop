FROM node:22-slim

# Pin matches plugins/dsh-software-factory dsh.runtime. pnpm is required by
# `dsh plugin add`. bubblewrap backs dsh's local sandbox on Linux.
ENV DSH_VERSION=0.1.5-rc.2
RUN apt-get update \
  && apt-get install -y --no-install-recommends bubblewrap ca-certificates git \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.17.1 --activate \
  && npm install -g @deepseek-ai/dsh@${DSH_VERSION}

# node:22-slim already ships a UID-1000 "node" user; reuse it as dsh's owner.
ENV DSH_HOME=/home/node/.dsh
RUN mkdir -p /workspace "$DSH_HOME" \
  && chown -R node:node /workspace "$DSH_HOME"

COPY relax-web-auth.mjs /usr/local/lib/relax-web-auth.mjs
RUN node /usr/local/lib/relax-web-auth.mjs

COPY allow-lan-bind.mjs /usr/local/lib/allow-lan-bind.mjs
RUN node /usr/local/lib/allow-lan-bind.mjs

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER node
WORKDIR /workspace

EXPOSE 3080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["web", "--no-open"]
