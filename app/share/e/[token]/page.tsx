import type { Metadata } from "next";

import { SharedEditor } from "@/components/shared-editor";

export const metadata: Metadata = {
  referrer: "no-referrer",
};

export default async function SharedEditPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharedEditor token={token} mode="edit" />;
}
