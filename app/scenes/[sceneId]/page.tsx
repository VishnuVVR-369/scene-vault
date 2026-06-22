import { Editor } from "@/components/editor";

export default async function ScenePage({
  params,
}: {
  params: Promise<{ sceneId: string }>;
}) {
  const { sceneId } = await params;
  return <Editor sceneId={sceneId} />;
}
