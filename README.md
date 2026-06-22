# SceneVault

SceneVault is a personal Excalidraw library service with nested folders, unlimited scenes, title/folder search, last-save persistence, and permanent deletes.

## Stack

- Next.js App Router
- Excalidraw React package
- Clerk auth
- Convex metadata database
- Cloudflare R2 scene bundle storage
- Zod validation at app, storage, and client data boundaries

## Local Demo Mode

Use local demo mode when Clerk, Convex, and R2 are not configured yet. It stores scenes in browser `localStorage`.

```bash
NEXT_PUBLIC_LOCAL_DATA=1 pnpm dev
```

Open http://localhost:3000/dashboard.

## Production Setup

1. Copy `.env.example` to `.env.local`.
2. Fill Clerk keys and URLs.
3. Link Convex with `pnpm exec convex dev`, then set `NEXT_PUBLIC_CONVEX_URL` and `CLERK_FRONTEND_API_URL`.
4. Create an R2 bucket and S3 API token, then fill the `CLOUDFLARE_R2_*` variables.
5. Configure R2 CORS to allow browser `PUT` uploads from your app origin.

Convex `_generated` files are not created until the project is linked. Run `pnpm exec convex dev` before deploying the Convex backend.

## Verification

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm e2e
```

The Playwright suite runs in local demo mode and covers nested folders, folder-name search, scene creation, editor load, autosave, and rename persistence.
