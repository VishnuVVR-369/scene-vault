"use client";

import { Loader2, TriangleAlert, WandSparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ZodError } from "zod";

import { useLibrary } from "@/components/library-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import {
  AI_DIAGRAM_PROMPT_MAX_LENGTH,
  aiDiagramResponseSchema,
  mermaidForExcalidraw,
  type AiDiagramResponse,
} from "@/lib/ai-diagram";
import type { SceneBundle } from "@/lib/domain";
import { normalizeSceneBundle } from "@/lib/excalidraw-scene";
import { cn } from "@/lib/utils";

type GenerationStage = "idle" | "generating" | "rendering" | "saving";

type ApiError = {
  error?: string;
};

export type GeneratedAiDiagram = AiDiagramResponse & {
  bundle: SceneBundle;
};

type MermaidParser =
  typeof import("@excalidraw/mermaid-to-excalidraw").parseMermaidToExcalidraw;

async function parseMermaidSafely(
  parseMermaidToExcalidraw: MermaidParser,
  mermaid: string,
) {
  const normalized = mermaidForExcalidraw(mermaid);
  return parseMermaidToExcalidraw(normalized, {
    maxEdges: 300,
    maxTextSize: 12000,
    themeVariables: { fontSize: "24px" },
  });
}

function getStageLabel(stage: GenerationStage) {
  switch (stage) {
    case "generating":
      return "Generating Mermaid";
    case "rendering":
      return "Rendering diagram";
    case "saving":
      return "Saving scene";
    default:
      return "Generate diagram";
  }
}

async function readApiError(response: Response) {
  try {
    const body = (await response.json()) as ApiError;
    return body.error || "AI diagram generation failed.";
  } catch {
    return "AI diagram generation failed.";
  }
}

export function AiDiagramDialog({
  folderId,
  className,
  disabled,
  onDiagramReady,
  successTitle = "AI diagram created",
}: {
  folderId?: string | null;
  className?: string;
  disabled?: boolean;
  onDiagramReady?: (diagram: GeneratedAiDiagram) => Promise<void> | void;
  successTitle?: string;
}) {
  const library = useLibrary();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [stage, setStage] = useState<GenerationStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<AiDiagramResponse | null>(null);
  const busy = stage !== "idle";
  const trimmedPrompt = prompt.trim();
  const canSubmit = trimmedPrompt.length >= 10 && !busy;

  async function submit() {
    if (!canSubmit) {
      return;
    }

    setError(null);
    setGenerated(null);
    setStage("generating");

    try {
      const response = await fetch("/api/ai/diagram", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const diagram = aiDiagramResponseSchema.parse(await response.json());
      setGenerated(diagram);
      setStage("rendering");

      const [{ parseMermaidToExcalidraw }, { convertToExcalidrawElements }] =
        await Promise.all([
          import("@excalidraw/mermaid-to-excalidraw"),
          import("@excalidraw/excalidraw"),
        ]);

      const parsed = await parseMermaidSafely(
        parseMermaidToExcalidraw,
        diagram.mermaid,
      );
      const elements = convertToExcalidrawElements(parsed.elements, {
        regenerateIds: true,
      });

      if (!elements.length) {
        throw new Error("The generated Mermaid did not produce a diagram.");
      }

      const bundle = normalizeSceneBundle({
        appState: { viewBackgroundColor: "#ffffff" },
        elements,
        files: parsed.files ?? {},
        source: "scenevault-ai",
        type: "excalidraw",
        version: 2,
      });

      setStage("saving");
      if (onDiagramReady) {
        await onDiagramReady({ ...diagram, bundle });
      } else {
        const sceneId = await library.createScene(
          diagram.title,
          folderId ?? null,
        );
        try {
          await library.saveSceneBundle(sceneId, bundle);
        } catch (saveError) {
          await library.deleteScene(sceneId).catch(() => undefined);
          throw saveError;
        }
        router.push(`/scenes/${sceneId}`);
      }

      toast({ variant: "success", title: successTitle });
      setPrompt("");
      setOpen(false);
    } catch (submitError) {
      const message =
        submitError instanceof ZodError
          ? "AI returned an unexpected response."
          : submitError instanceof Error
            ? submitError.message
            : "Could not create the AI diagram.";
      setError(message);
      toast({
        variant: "error",
        title: "Couldn't create AI diagram",
        description: message,
      });
    } finally {
      setStage("idle");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          setOpen(next);
        }
      }}
    >
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn("shadow-sketch-sm", className)}
      >
        <WandSparkles />
        AI diagram
      </Button>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">AI diagram</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="ai-diagram-prompt">Prompt</Label>
              <span className="font-mono text-[11px] text-muted-foreground">
                {trimmedPrompt.length}/{AI_DIAGRAM_PROMPT_MAX_LENGTH}
              </span>
            </div>
            <textarea
              id="ai-diagram-prompt"
              autoFocus
              maxLength={AI_DIAGRAM_PROMPT_MAX_LENGTH}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="e.g. Show a sequence from checkout to payment authorization to receipt"
              className="min-h-36 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
              disabled={busy}
            />
          </div>

          {error ? (
            <div
              role="alert"
              className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}

          {generated ? (
            <div className="space-y-2">
              <Label htmlFor="ai-diagram-mermaid">Mermaid</Label>
              <textarea
                id="ai-diagram-mermaid"
                readOnly
                value={generated.mermaid}
                className="min-h-28 w-full resize-y rounded-lg border border-input bg-muted/40 px-3 py-2 font-mono text-xs outline-none"
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!canSubmit}>
            {busy ? <Loader2 className="animate-spin" /> : <WandSparkles />}
            {getStageLabel(stage)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
