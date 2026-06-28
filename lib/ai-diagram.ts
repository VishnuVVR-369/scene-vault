import { z } from "zod";

export const AI_DIAGRAM_PROMPT_MAX_LENGTH = 2000;
export const AI_DIAGRAM_MERMAID_MAX_LENGTH = 12000;
export const DEFAULT_OPENAI_MODEL = "gpt-5.5";

export const aiDiagramRequestSchema = z.object({
  prompt: z.string().trim().min(10).max(AI_DIAGRAM_PROMPT_MAX_LENGTH),
});

export const aiDiagramResponseSchema = z.object({
  title: z.string().trim().min(1).max(80),
  mermaid: z.string().trim().min(1).max(AI_DIAGRAM_MERMAID_MAX_LENGTH),
});

export const openAiOutputTextSchema = z.object({
  type: z.literal("output_text"),
  text: z.string(),
});

export const openAiMessageOutputSchema = z.object({
  type: z.literal("message"),
  content: z.array(z.union([openAiOutputTextSchema, z.unknown()])),
});

export const openAiResponseSchema = z.object({
  output: z.array(z.union([openAiMessageOutputSchema, z.unknown()])),
});

export type AiDiagramResponse = z.infer<typeof aiDiagramResponseSchema>;

export const aiDiagramJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      minLength: 1,
      maxLength: 80,
    },
    mermaid: {
      type: "string",
      minLength: 1,
      maxLength: AI_DIAGRAM_MERMAID_MAX_LENGTH,
    },
  },
  required: ["title", "mermaid"],
} as const;

const UNSAFE_MERMAID_PATTERNS = [
  /<\s*script/i,
  /<\s*iframe/i,
  /javascript\s*:/i,
  /%%\s*\{\s*init/i,
];

const SUBGRAPH_PATTERN = /^\s*subgraph\b/i;
const SUBGRAPH_DIRECTION_PATTERN = /^\s*direction\s+(?:TB|TD|BT|RL|LR)\s*$/i;
const SUBGRAPH_END_PATTERN = /^\s*end\s*$/i;

export function buildDiagramSystemPrompt() {
  return [
    "You generate Mermaid diagrams for SceneVault, an Excalidraw library app.",
    "Return only valid JSON with keys title and mermaid.",
    "The title must be concise and at most 80 characters.",
    "The mermaid value must be Mermaid syntax only, without markdown fences.",
    "Prefer flowchart TD or flowchart LR. Use class or sequence diagrams only when the user explicitly asks.",
    "Do not use Mermaid subgraph blocks. Represent groups with ordinary nodes and edges instead.",
    "Avoid unsupported Mermaid features, HTML, scripts, icons, custom init blocks, and extremely dense diagrams.",
    "Keep node labels short and human-readable.",
  ].join(" ");
}

export function buildDiagramUserPrompt(prompt: string) {
  return [
    "Create a Mermaid diagram from this request.",
    'Return exactly one JSON object like {"title":"...","mermaid":"flowchart TD\\n  A[Start] --> B[End]"}.',
    "",
    "Request:",
    prompt.trim(),
  ].join("\n");
}

export function extractOpenAiOutputText(response: unknown) {
  const parsed = openAiResponseSchema.parse(response);
  return parsed.output
    .filter((item): item is z.infer<typeof openAiMessageOutputSchema> => {
      return (
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        item.type === "message"
      );
    })
    .flatMap((item) =>
      item.content.filter(
        (part): part is z.infer<typeof openAiOutputTextSchema> => {
          return (
            typeof part === "object" &&
            part !== null &&
            "type" in part &&
            part.type === "output_text"
          );
        },
      ),
    )
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return extractJsonObject(fenced[1]);
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  throw new Error("AI response did not include a JSON object.");
}

export function assertSafeMermaid(mermaid: string) {
  if (UNSAFE_MERMAID_PATTERNS.some((pattern) => pattern.test(mermaid))) {
    throw new Error("Mermaid contains unsupported unsafe syntax.");
  }
}

export function stripMermaidSubgraphs(mermaid: string) {
  const lines = mermaid.split(/\r?\n/);
  let insideSubgraph = 0;
  let changed = false;

  const nextLines = lines.filter((line) => {
    if (SUBGRAPH_PATTERN.test(line)) {
      insideSubgraph += 1;
      changed = true;
      return false;
    }

    if (insideSubgraph > 0 && SUBGRAPH_END_PATTERN.test(line)) {
      insideSubgraph -= 1;
      changed = true;
      return false;
    }

    if (insideSubgraph > 0 && SUBGRAPH_DIRECTION_PATTERN.test(line)) {
      changed = true;
      return false;
    }

    return true;
  });

  return changed ? nextLines.join("\n").trim() : mermaid;
}

export function mermaidForExcalidraw(mermaid: string) {
  return stripMermaidSubgraphs(mermaid);
}

export function parseAiDiagramResponse(text: string): AiDiagramResponse {
  const json = JSON.parse(extractJsonObject(text)) as unknown;
  const parsed = aiDiagramResponseSchema.parse(json);
  assertSafeMermaid(parsed.mermaid);
  return parsed;
}
