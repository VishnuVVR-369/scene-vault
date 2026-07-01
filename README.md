# SceneVault

SceneVault is a personal Excalidraw library service with nested folders, unlimited scenes, title/folder search, last-save persistence, and permanent deletes.

## Stack

- Next.js App Router
- Excalidraw React package
- Better Auth with Google/GitHub sign-in
- Convex metadata database
- Cloudflare R2 scene bundle storage
- Zod validation at app, storage, and client data boundaries

## Local Demo Mode

Use local demo mode when Better Auth, Convex, and R2 are not configured yet. It stores scenes in browser `localStorage`.

```bash
NEXT_PUBLIC_LOCAL_DATA=1 pnpm dev
```

Open http://localhost:3000/dashboard.

## Production Setup

1. Copy `.env.example` to `.env.local`.
2. Link and push Convex with `pnpm exec convex dev --once`.
3. In `.env.local`, set `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_SITE_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, and `SITE_URL` or `BETTER_AUTH_URL`.
4. In Convex env, set `SITE_URL` or `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, and Google/GitHub OAuth credentials.
5. Create an R2 bucket and S3 API token, then fill the `CLOUDFLARE_R2_*` variables.
6. Configure R2 CORS to allow browser `PUT` uploads from your app origin.

Better Auth handles all current sign-in and session state. OAuth providers
should call back to the Next.js app, not directly to Convex:

```text
GitHub local callback: http://localhost:3000/api/auth/callback/github
Google local callback: http://localhost:3000/api/auth/callback/google

GitHub production callback: https://your-domain.com/api/auth/callback/github
Google production callback: https://your-domain.com/api/auth/callback/google
```

Set the Better Auth and OAuth values on the active Convex deployment:

```bash
pnpm exec convex env set SITE_URL http://localhost:3000
pnpm exec convex env set BETTER_AUTH_SECRET "<generated-secret>"
pnpm exec convex env set GITHUB_CLIENT_ID "<github-client-id>"
pnpm exec convex env set GITHUB_CLIENT_SECRET "<github-client-secret>"
pnpm exec convex env set GOOGLE_CLIENT_ID "<google-client-id>"
pnpm exec convex env set GOOGLE_CLIENT_SECRET "<google-client-secret>"
```

`/api/auth/*` is proxied from Next.js to the Convex site URL. If social sign-in
returns `This Convex deployment does not have HTTP actions enabled`, run
`pnpm exec convex dev --once` so `convex/http.ts` is pushed to the active Convex
deployment.

SceneVault uses Better Auth as the only authentication system. Convex creates a
SceneVault profile for a signed-in Better Auth subject on first write, then
folders, scenes, shares, and live rooms reference that profile directly.

Convex `_generated` files and HTTP actions are not created until the project is linked and pushed. Run `pnpm exec convex dev --once` before deploying the Convex backend.

## Verification

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm e2e
```

The Playwright suite runs in local demo mode and covers nested folders, folder-name search, scene creation, editor load, autosave, and rename persistence.
