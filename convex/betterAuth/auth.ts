import { betterAuth } from "better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { createClient } from "@convex-dev/better-auth";
import type { BetterAuthOptions } from "better-auth";
import type { GenericCtx } from "@convex-dev/better-auth";

import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import schema from "./schema";

export const authComponent = createClient<DataModel, typeof schema>(
  components.betterAuth,
  {
    local: { schema },
  },
);

export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
  ({
    basePath: "/api/auth",
    baseURL: process.env.SITE_URL ?? process.env.BETTER_AUTH_URL,
    database: authComponent.adapter(ctx),
    secret: process.env.BETTER_AUTH_SECRET,
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      },
    },
    rateLimit: {
      storage: "database",
    },
    plugins: [
      convex({
        authConfig,
      }),
    ],
  }) satisfies BetterAuthOptions;

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));
