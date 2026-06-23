import type { Metadata } from "next";

import { DocsPage } from "@/components/docs-page";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "SceneVault developer docs — features, technical architecture, data model, storage, sharing, live collaboration, local development, and production setup.",
};

export default function Docs() {
  return <DocsPage />;
}
