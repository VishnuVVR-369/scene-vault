import { describe, expect, it } from "vitest";

import {
  aiDiagramRequestSchema,
  extractOpenAiOutputText,
  extractJsonObject,
  parseAiDiagramResponse,
  stripMermaidSubgraphs,
} from "@/lib/ai-diagram";

describe("AI diagram helpers", () => {
  it("validates and trims diagram prompts", () => {
    expect(
      aiDiagramRequestSchema.parse({ prompt: "  Build a checkout flow  " }),
    ).toEqual({ prompt: "Build a checkout flow" });
    expect(() => aiDiagramRequestSchema.parse({ prompt: "short" })).toThrow();
  });

  it("extracts JSON from fenced or prefixed model output", () => {
    expect(
      extractJsonObject('```json\n{"title":"T","mermaid":"flowchart TD"}\n```'),
    ).toBe('{"title":"T","mermaid":"flowchart TD"}');
    expect(
      extractJsonObject('Result:\n{"title":"T","mermaid":"flowchart TD"}'),
    ).toBe('{"title":"T","mermaid":"flowchart TD"}');
  });

  it("joins output text blocks from OpenAI Responses API output", () => {
    expect(
      extractOpenAiOutputText({
        output: [
          { type: "reasoning", summary: [] },
          {
            type: "message",
            content: [
              { type: "output_text", text: '{"title":"Checkout",' },
              { type: "refusal", refusal: "ignored" },
              {
                type: "output_text",
                text: '"mermaid":"flowchart TD\\nA-->B"}',
              },
            ],
          },
        ],
      }),
    ).toBe('{"title":"Checkout",\n"mermaid":"flowchart TD\\nA-->B"}');
  });

  it("parses safe diagram JSON and rejects unsafe Mermaid", () => {
    expect(
      parseAiDiagramResponse(
        '{"title":"Checkout","mermaid":"flowchart TD\\nA[Cart] --> B[Pay]"}',
      ),
    ).toEqual({
      title: "Checkout",
      mermaid: "flowchart TD\nA[Cart] --> B[Pay]",
    });

    expect(() =>
      parseAiDiagramResponse(
        '{"title":"Bad","mermaid":"flowchart TD\\nA[<script>alert(1)</script>]"}',
      ),
    ).toThrow("unsafe");
  });

  it("unwraps Mermaid subgraphs before Excalidraw conversion", () => {
    expect(
      stripMermaidSubgraphs(
        [
          "flowchart TD",
          "  Start[Start] --> A",
          "  subgraph Group[Checkout]",
          "    direction LR",
          "    A[Cart] --> B[Payment]",
          "  end",
          "  B --> Done[Receipt]",
        ].join("\n"),
      ),
    ).toBe(
      [
        "flowchart TD",
        "  Start[Start] --> A",
        "    A[Cart] --> B[Payment]",
        "  B --> Done[Receipt]",
      ].join("\n"),
    );
  });
});
