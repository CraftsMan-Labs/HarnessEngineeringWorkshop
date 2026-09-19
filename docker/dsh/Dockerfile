FROM node:22-slim

# bubblewrap backs dsh's local sandbox on Linux (workspace-write mode);
# git is needed by profile/plugin installs.
RUN apt-get update \
  && apt-get install -y --no-install-recommends bubblewrap ca-certificates git \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g @deepseek-ai/dsh

RUN useradd --create-home --uid 1000 --shell /bin/bash dsh

ENV DSH_HOME=/home/dsh/.dsh
RUN mkdir -p /workspace "$DSH_HOME" \
  && chown -R dsh:dsh /workspace "$DSH_HOME"

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER dsh
WORKDIR /workspace

EXPOSE 3080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["web", "--no-open"]
