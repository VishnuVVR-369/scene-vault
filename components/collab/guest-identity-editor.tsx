"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COLLAB_COLORS } from "@/lib/collab/colors";
import { type CollabIdentity } from "@/lib/collab/identity";
import { cn } from "@/lib/utils";

export function GuestIdentityEditor({
  identity,
  onChange,
}: {
  identity: CollabIdentity;
  onChange: (next: CollabIdentity) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(identity.name);
  const [color, setColor] = useState(identity.color);

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        className="gap-1.5 bg-card/90 shadow-sm backdrop-blur"
        onClick={() => {
          setName(identity.name);
          setColor(identity.color);
          setOpen(true);
        }}
      >
        <span
          className="size-3 rounded-full"
          style={{ backgroundColor: identity.color }}
        />
        <span className="max-w-28 truncate">{identity.name}</span>
        <Pencil className="size-3" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              Your collaborator identity
            </DialogTitle>
            <DialogDescription>
              How you appear to others in this room. Visible to everyone with
              the link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="guest-name">Display name</Label>
              <Input
                id="guest-name"
                value={name}
                maxLength={40}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cursor color</Label>
              <div className="flex flex-wrap gap-2">
                {COLLAB_COLORS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-label={`Pick color ${option}`}
                    className={cn(
                      "size-7 rounded-full border-2 transition",
                      color === option
                        ? "border-foreground"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: option }}
                    onClick={() => setColor(option)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onChange({ name: name.trim() || "Guest", color });
                setOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
