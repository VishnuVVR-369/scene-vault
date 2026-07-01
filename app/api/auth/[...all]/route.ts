import { authHandler } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = authHandler.GET;
export const POST = authHandler.POST;
