# UN deployment preparation

Reserved Sites address: https://un-property-review-desk.dudu-f.chatgpt.site

GitHub repository: https://github.com/shuhang-f/UN (created private; source upload pending).

The Site is registered but unpublished. The user requested the link now and will connect Railway later.

## Architecture

Browser → private ChatGPT Site gateway → Railway Next.js app → Railway volume at `/data`.

Railway renders the current interface and runs its APIs. The Sites Worker in `deploy/sites` forwards requests and chat streams through the same browser origin. It validates browser write origins before rewriting requests for Railway, forwards only UN session cookies, and injects a backend credential on the server. Sites visitor authentication stays at the Sites boundary. Keep the Site private until the intended audience is explicitly selected.

## Railway setup

1. Push the reviewed source to the UN repository. Preserve the existing CopilotKit starter remote; do not push product changes there.
2. Create one Railway service from the repository root. The root `Dockerfile` and `railway.json` select the web app; do not create mobile or Channels services.
3. Attach a volume at `/data` and keep one replica. The health check rejects Railway deployments without that mount. Back up this volume; browser session cookies identify each review history.
4. Generate a Railway HTTPS domain. Set the variables in `.env.railway.example`, including that origin and a random shared password of at least 24 characters. Railway's root-mounted volume needs `RAILWAY_RUN_UID=0` for this image.
5. Deploy and check `/api/health`. The remaining routes require the shared demo credential. No model key is required for guided sample workflows. Configure optional provider keys only as service secrets.

The shared credential is suitable for a controlled hackathon demonstration. The email entry remains a browser-only simulation, not user authentication. Real customer tenancy needs per-user authorization and durable identities.

## Sites connection later

Reuse `deploy/sites/.openai/hosting.json`; do not create another Site. Its ID and reserved address are already recorded. Stage this gateway as its own Sites checkout when publishing, preserving that manifest. Run the Sites hosting workflow, build the Worker with `npm run build` in `deploy/sites`, and supply supported Worker packaging with `dist/server/index.js` and the hosting manifest. Runtime values belong in Sites settings, never the manifest.

Set `BACKEND_ORIGIN` to the Railway HTTPS origin, `BACKEND_USERNAME=un`, and secret `BACKEND_PASSWORD` to the same value as `WEB_DEMO_PASSWORD`. Save and publish only after backend health and gateway tests pass. The gateway is not currently deployed or connected.

## Checks

`npm run verify` checks the existing app and the hosted access boundary. `npm run build` builds standalone Next.js and copies its static assets for `npm start`. `npm run check:deployment` checks the built standalone server. `npm test --prefix deploy/sites` checks gateway behavior. GitHub CI also builds the Docker image.

The coordinating demo task reported a successful combined production build and 160 existing tests, including the new middleware and standalone configuration. The four new access-boundary tests also passed. Standalone smoke checks, Docker validation and live gateway verification remain pending for hookup. Docker was not running during preparation. Sites' local publishing helper files became unavailable during this session, so restore the Sites plugin tooling before publishing.

References: [Railway Next.js](https://docs.railway.com/guides/nextjs), [persistent volumes](https://docs.railway.com/volumes), [configuration](https://docs.railway.com/config-as-code/reference).
