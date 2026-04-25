---
description: "Use when working on Windows packaging, local installer first, Docker trial build service, smoke tests, webhook triggers, reverse proxy, or Cloudflare exposure for pop-launcher."
name: "Build And Delivery"
applyTo:
  - "Dockerfile"
  - "docker-compose.yml"
  - "package.json"
  - "tools/build-agent/**"
  - "README.md"
  - "README_CN.md"
---

# Build And Delivery Guidelines

- Default sequence for this repo:
  - get the native Windows installer working locally first
  - use the Docker build service only as a trial and smoke-test stage on this machine unless the user explicitly asks to promote it
- Treat packaging as staged surfaces rather than equal priorities:
  - Primary native Windows build: `npm run build` or `npm run build:win`; artifact lands in `dist/`
  - Trial HTTP build service: `npm run start:build-service` or `npm run docker:build-service`; job state lands in `build-service-data/`, exported installers land in `artifacts/`, and the container writes its temporary build output to `docker-dist/`
- Do not try to run the Electron app inside Docker as the product runtime. The container only produces and serves the installer artifact.
- Preserve installer parity: Docker builds should emit the same NSIS installer users get from the native Windows packaging flow.
- If time or scope is limited, spend effort on native installer correctness before Docker automation.
- For local runtime scenarios, remember the installed launcher can open absolute Windows paths and `http://` or `https://` URLs, including localhost ports published by other local Docker containers.
- When changing `tools/build-agent/server.js`:
  - keep `BUILD_TOKEN` support for anything beyond trusted local use
  - preserve `x-forwarded-proto` and `x-forwarded-host` handling so reverse-proxied download URLs stay correct
  - keep the API focused on health, build trigger, status, logs, and artifact download
- For smoke tests, validate the narrowest surface first:
  - server syntax or startup for `tools/build-agent/server.js`
  - `GET /healthz` and `GET /builds` before a full build trigger
  - native `npm run build:win` or containerized build only when the touched change affects packaging or artifact flow
- Link to [README.md](../../README.md) and [README_CN.md](../../README_CN.md) for endpoint examples and operator steps instead of copying them into instructions.