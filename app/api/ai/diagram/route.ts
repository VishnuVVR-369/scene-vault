import { auth } from "@clerk/nextjs/server";

import {
  aiDiagramJsonSchema,
  aiDiagramRequestSchema,
  buildDiagramSystemPrompt,
  buildDiagramUserPrompt,
  DEFAULT_OPENAI_MODEL,
  extractOpenAiOutputText,
  parseAiDiagramResponse,
} from "@/lib/ai-diagram";
import { noStoreJson, parseJsonBody } from "@/lib/scene-storage-access";

export const runtime = "nodejs";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const shouldRequireAuth =
  process.env.NEXT_PUBLIC_LOCAL_DATA !== "1" &&
  Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
  );

async function requireAiAccess() {
  if (!shouldRequireAuth) {
    return null;
  }

  const { userId } = await auth();
  if (!userId) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export async function POST(request: Request) {
  const authResponse = await requireAiAccess();
  if (authResponse) {
    return authResponse;
  }

  const bodyResult = await parseJsonBody(
    request,
    aiDiagramRequestSchema,
    "Invalid diagram prompt",
  );
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return noStoreJson(
      { error: "AI diagram generation is not configured" },
      { status: 503 },
    );
  }

  try {
    const openAiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        input: buildDiagramUserPrompt(bodyResult.data.prompt),
        instructions: buildDiagramSystemPrompt(),
        max_output_tokens: 1800,
        model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
        store: false,
        text: {
          format: {
            name: "ai_diagram",
            schema: aiDiagramJsonSchema,
            strict: true,
            type: "json_schema",
          },
          verbosity: "low",
        },
      }),
    });

    if (!openAiResponse.ok) {
      return noStoreJson(
        { error: "AI diagram generation failed" },
        { status: 502 },
      );
    }

    const text = extractOpenAiOutputText(await openAiResponse.json());
    return noStoreJson(parseAiDiagramResponse(text));
  } catch (error) {
    console.error("AI diagram generation failed", error);
    return noStoreJson(
      { error: "AI returned an invalid diagram" },
      { status: 502 },
    );
  }
}
