"use client";

import { CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ScribbleUnderline, Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const HIGHLIGHTS = [
  "Tidy folders for every project",
  "Autosave to the cloud as you draw",
  "The full Excalidraw editor, built in",
];

export function AuthShell({
  highlightWord,
  children,
}: {
  /** The emphasised word in the side-panel headline, e.g. "home". */
  highlightWord: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Branded panel */}
      <aside className="bg-paper-dots relative hidden flex-col justify-between overflow-hidden border-r border-border bg-sidebar p-10 lg:flex">
        <Wordmark />

        <div className="max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight">
            A cozy{" "}
            <span className="relative inline-block text-primary">
              {highlightWord}
              <ScribbleUnderline />
            </span>{" "}
            for your Excalidraw drawings.
          </h1>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-3 text-muted-foreground">
                <CheckCircle2 className="size-5 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="font-mono text-xs text-muted-foreground">
          Stop losing sketches in your Downloads folder.
        </p>
      </aside>

      {/* Form column */}
      <main className="bg-paper-dots relative flex flex-col px-5 lg:bg-none">
        <div className="flex h-16 items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-9 px-2.5">
            <Link href="/">
              <ArrowLeft />
              Back home
            </Link>
          </Button>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center pb-16">
          <div className="w-full max-w-sm">
            <div className="mb-6 lg:hidden">
              <Wordmark />
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export function AuthNotConfigured({ action }: { action: string }) {
  return (
    <div className="sketch-card bg-card p-8 text-center">
      <h2 className="font-display text-xl font-bold">Auth isn&apos;t set up yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Add your Clerk keys to enable {action}. You can still explore the app in
        local mode.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Open the app</Link>
      </Button>
    </div>
  );
}
