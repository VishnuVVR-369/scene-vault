"use client";

import { Copy, Link2, RefreshCw, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type ShareMode = "view" | "edit";
type SceneShares = {
  view: { token: string; enabled: boolean; updatedAt: number } | null;
  edit: { token: string; enabled: boolean; updatedAt: number } | null;
};

const canUseRemoteSharing =
  process.env.NEXT_PUBLIC_LOCAL_DATA !== "1" &&
  Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

const refs = {
  getSharesForScene: makeFunctionReference<
    "query",
    { sceneId: string },
    SceneShares
  >("library:getSharesForScene"),
  createOrRotateShare: makeFunctionReference<
    "mutation",
    { sceneId: string; mode: ShareMode },
    string
  >("library:createOrRotateShare"),
  setShareEnabled: makeFunctionReference<
    "mutation",
    { sceneId: string; mode: ShareMode; enabled: boolean },
    null
  >("library:setShareEnabled"),
};

export function ShareSceneDialog({
  sceneId,
  open,
  onOpenChange,
}: {
  sceneId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!canUseRemoteSharing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Share scene</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Sharing needs Better Auth, Convex, and R2 remote mode. Local demo
            scenes stay inside this browser.
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <RemoteShareSceneDialog
      sceneId={sceneId}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

function RemoteShareSceneDialog({
  sceneId,
  open,
  onOpenChange,
}: {
  sceneId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const shares = useQuery(refs.getSharesForScene, open ? { sceneId } : "skip");
  const createOrRotate = useMutation(refs.createOrRotateShare);
  const setEnabled = useMutation(refs.setShareEnabled);
  const [busy, setBusy] = useState<ShareMode | null>(null);
  const [copied, setCopied] = useState<ShareMode | null>(null);

  const origin = useMemo(
    () => (typeof window === "undefined" ? "" : window.location.origin),
    [],
  );

  async function ensureLink(mode: ShareMode) {
    const current = shares?.[mode];
    if (current) {
      return current.token;
    }
    return await createOrRotate({ sceneId, mode });
  }

  async function copyLink(mode: ShareMode) {
    setBusy(mode);
    try {
      const token = await ensureLink(mode);
      const path = mode === "view" ? `/share/v/${token}` : `/share/e/${token}`;
      await navigator.clipboard.writeText(`${origin}${path}`);
      setCopied(mode);
      window.setTimeout(() => setCopied(null), 1800);
    } finally {
      setBusy(null);
    }
  }

  async function rotateLink(mode: ShareMode) {
    setBusy(mode);
    try {
      await createOrRotate({ sceneId, mode });
    } finally {
      setBusy(null);
    }
  }

  async function toggle(mode: ShareMode) {
    const current = shares?.[mode];
    setBusy(mode);
    try {
      if (!current) {
        await createOrRotate({ sceneId, mode });
        return;
      }
      await setEnabled({ sceneId, mode, enabled: !current.enabled });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Share2 className="size-5" />
            Share scene
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <ShareRow
            mode="view"
            title="View link"
            description="Anyone with this link can view and duplicate the scene."
            share={shares?.view ?? null}
            busy={busy === "view"}
            copied={copied === "view"}
            onCopy={() => void copyLink("view")}
            onRotate={() => void rotateLink("view")}
            onToggle={() => void toggle("view")}
          />
          <Separator />
          <ShareRow
            mode="edit"
            title="Edit link"
            description="Signed-in users with this link can save changes."
            share={shares?.edit ?? null}
            busy={busy === "edit"}
            copied={copied === "edit"}
            onCopy={() => void copyLink("edit")}
            onRotate={() => void rotateLink("edit")}
            onToggle={() => void toggle("edit")}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShareRow({
  title,
  description,
  share,
  busy,
  copied,
  onCopy,
  onRotate,
  onToggle,
}: {
  mode: ShareMode;
  title: string;
  description: string;
  share: { token: string; enabled: boolean } | null;
  busy: boolean;
  copied: boolean;
  onCopy: () => void;
  onRotate: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-sm font-semibold">{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={share?.enabled ? "secondary" : "outline"}
          onClick={onToggle}
          disabled={busy}
        >
          <Link2 />
          {share?.enabled ? "Enabled" : share ? "Disabled" : "Create link"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCopy} disabled={busy}>
          <Copy />
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Reset ${title.toLowerCase()}`}
          onClick={onRotate}
          disabled={busy || !share}
        >
          <RefreshCw />
        </Button>
      </div>
    </div>
  );
}
