# UN deployment

Deployed September 12, 2026:

- Public website: https://un-property-review-desk.dudu-f.chatgpt.site
- Additional owner-private Site (Krasp): https://un.dudu-f.chatgpt.site
- Private GitHub repository: https://github.com/shuhang-f/UN
- Railway application origin: https://un-web-production.up.railway.app

## Architecture

Browser → Sites gateway → Railway Next.js app → persistent Railway volume at `/data`.

Railway renders the interface and runs its APIs. The Worker in `deploy/sites` forwards requests and chat streams through the same browser origin. It validates write origins, forwards only application session cookies, and adds the backend credential on the server. The credential is never sent to visitors. The original Site is public by explicit request; the short Site retains owner-only access. GitHub remains private.

Email onboarding and AmbiguousAI processing are clearly labeled simulations. No provider keys are configured. Reviews and letter approvals are stored by browser session, not email identity. This is the sample-data hackathon app; customer accounts and real external delivery require further integration.

## Railway

Project `un-property-review-desk` (`293ffeb4-69e5-4df9-83ad-8469b818ad91`) contains service `un-web` (`6dd645b2-b7d7-47e7-bbc4-3194c2c06ba2`). It deploys the root Dockerfile from `shuhang-f/UN`, branch `main`.

One replica uses volume `un-web-volume` (`2a75541a-8d01-4024-a2a5-a871ef5c2148`) at `/data`. The application health route checks configuration and the mounted directory. Back up this volume before destructive maintenance.

Service variables follow `.env.railway.example`. Keep `PORT=3000`, `HOSTNAME=0.0.0.0`, and the public domain target port at 3000. Railway otherwise injects port 8080, which does not match that domain target. `WEB_APP_ORIGIN` is the Railway HTTPS origin; `WEB_DEMO_PASSWORD` is a generated secret. `RAILWAY_RUN_UID=0` allows writing the attached volume.

The shared credential protects direct Railway access. Sites injects it for visitors. Never place the password or optional provider keys in Git, frontend code, or the hosting manifest.

## Sites

Reuse the existing registrations:

- Original: `deploy/sites/.openai/hosting.json`, project `appgprj_6aa5d25d85008191b89b4dcf79b3661c`.
- Short: `deploy/krasp-sites/.openai/hosting.json`, project `appgprj_6aa5d2fbf2388191a45a6a5cc94cfbce`.

Both use the same gateway source and runtime settings: `BACKEND_ORIGIN` is the Railway HTTPS origin, `BACKEND_USERNAME=un`, and secret `BACKEND_PASSWORD` matches Railway's `WEB_DEMO_PASSWORD`. Set runtime values through Sites. Preserve each Site's manifest and audience.

Gateway source checkouts are sibling directories `un-site` and `un-short-site`. Each has its own Sites source repository. Follow the Sites hosting workflow for gateway edits. Ordinary app changes deploy from GitHub to Railway and are available through both gateways without republishing the gateway.

## Validation

- All 185 workspace tests passed; product browser verification is recorded in `un-verification.md`.
- Production Next.js build and standalone checks passed: health, authentication, cross-origin rejection, secure sessions, save/reload across restart, and fail-closed configuration.
- Four gateway tests passed.
- Railway built the Docker image and deployed product commit `9c43d6302e1ab4d932850c01ec46802a33e32e4c`.
- Live Railway and gateway checks passed for HTML, static assets, hidden credentials, secure cookies, review save/reload, session isolation, and cross-origin rejection.
- Both native Sites deployments succeeded with environment revision 1. Original Site access was explicitly updated to public.

GitHub CI runs `npm run verify`, production build, standalone checks, gateway tests, and a Docker build. Run `npm run check:deployment` after building to repeat the standalone checks locally.

Railway's new-service settings are authoritative: Dockerfile detection, health path `/api/health`, timeout 120 seconds, and three restart retries. The legacy `railway.json` records the intended settings, but new services cannot opt into Config as Code after August 28, 2026. Use service settings or Railway Infrastructure as Code for future changes; do not assume editing that legacy file changes the live service.

References: [Railway Next.js](https://docs.railway.com/guides/nextjs), [persistent volumes](https://docs.railway.com/volumes), [configuration](https://docs.railway.com/config-as-code/reference).
