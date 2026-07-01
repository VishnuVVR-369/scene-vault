import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

const r2EnvSchema = z.object({
  CLOUDFLARE_R2_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().min(1),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().min(1),
  CLOUDFLARE_R2_BUCKET: z.string().min(1),
});

let cachedClient: S3Client | null = null;

function getR2Config() {
  return r2EnvSchema.parse(process.env);
}

function getR2Client() {
  const config = getR2Config();
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${config.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: config.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return { client: cachedClient, bucket: config.CLOUDFLARE_R2_BUCKET };
}

export function buildSceneObjectKey(profileId: string, sceneId: string) {
  const safeProfileId = encodeURIComponent(profileId);
  const safeSceneId = encodeURIComponent(sceneId);
  return `users/${safeProfileId}/scenes/${safeSceneId}/head/excalidraw.json`;
}

export function buildSceneThumbnailObjectKey(
  profileId: string,
  sceneId: string,
) {
  const safeProfileId = encodeURIComponent(profileId);
  const safeSceneId = encodeURIComponent(sceneId);
  return `users/${safeProfileId}/scenes/${safeSceneId}/head/thumbnail.png`;
}

export function isSceneObjectKeyForProfile(args: {
  profileId: string;
  sceneId: string;
  key: string;
}) {
  return args.key === buildSceneObjectKey(args.profileId, args.sceneId);
}

export function isSceneThumbnailObjectKeyForProfile(args: {
  profileId: string;
  sceneId: string;
  key: string;
}) {
  return (
    args.key === buildSceneThumbnailObjectKey(args.profileId, args.sceneId)
  );
}

export async function createSceneUploadUrl(args: {
  profileId: string;
  sceneId: string;
  contentType: "application/json" | "application/vnd.excalidraw+json";
}) {
  const { client, bucket } = getR2Client();
  const key = buildSceneObjectKey(args.profileId, args.sceneId);
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: args.contentType,
    }),
    { expiresIn: 300 },
  );
  return { key, url };
}

export async function createSceneDownloadUrl(args: {
  profileId: string;
  sceneId: string;
}) {
  const { client, bucket } = getR2Client();
  const key = buildSceneObjectKey(args.profileId, args.sceneId);
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn: 300 },
  );
  return { key, url };
}

export async function createSceneThumbnailUploadUrl(args: {
  profileId: string;
  sceneId: string;
}) {
  const { client, bucket } = getR2Client();
  const key = buildSceneThumbnailObjectKey(args.profileId, args.sceneId);
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: "image/png",
    }),
    { expiresIn: 300 },
  );
  return { key, url };
}

// The dashboard renders thumbnails via an authenticated proxy route rather than
// signed URLs, so it can serve `<img src>` directly with cache headers. Returns
// null when the object doesn't exist yet (e.g. a scene saved before this
// feature, or one whose thumbnail upload failed).
export async function getSceneThumbnailObject(args: {
  profileId: string;
  sceneId: string;
}): Promise<{ body: Uint8Array; contentType: string } | null> {
  const { client, bucket } = getR2Client();
  const key = buildSceneThumbnailObjectKey(args.profileId, args.sceneId);
  try {
    const result = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const body = await result.Body?.transformToByteArray();
    if (!body) {
      return null;
    }
    return { body, contentType: result.ContentType ?? "image/png" };
  } catch {
    return null;
  }
}

export async function deleteSceneObject(args: {
  profileId: string;
  sceneId: string;
}) {
  const { client, bucket } = getR2Client();
  const key = buildSceneObjectKey(args.profileId, args.sceneId);
  const thumbnailKey = buildSceneThumbnailObjectKey(
    args.profileId,
    args.sceneId,
  );
  // Deletes are idempotent in R2, so removing the thumbnail unconditionally is
  // safe even for scenes that never had one.
  await Promise.all([
    client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
    client.send(new DeleteObjectCommand({ Bucket: bucket, Key: thumbnailKey })),
  ]);
  return { key };
}

export async function copySceneObject(args: {
  sourceProfileId: string;
  sourceSceneId: string;
  targetProfileId: string;
  targetSceneId: string;
}) {
  const { client, bucket } = getR2Client();
  const sourceKey = buildSceneObjectKey(
    args.sourceProfileId,
    args.sourceSceneId,
  );
  const targetKey = buildSceneObjectKey(
    args.targetProfileId,
    args.targetSceneId,
  );
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${sourceKey}`,
      Key: targetKey,
      ContentType: "application/json",
      MetadataDirective: "REPLACE",
    }),
  );
  return { sourceKey, targetKey };
}

export async function copySceneThumbnailObject(args: {
  sourceProfileId: string;
  sourceSceneId: string;
  targetProfileId: string;
  targetSceneId: string;
}) {
  const { client, bucket } = getR2Client();
  const sourceKey = buildSceneThumbnailObjectKey(
    args.sourceProfileId,
    args.sourceSceneId,
  );
  const targetKey = buildSceneThumbnailObjectKey(
    args.targetProfileId,
    args.targetSceneId,
  );
  try {
    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${sourceKey}`,
        Key: targetKey,
        ContentType: "image/png",
        MetadataDirective: "REPLACE",
      }),
    );
    return { sourceKey, targetKey };
  } catch {
    return null;
  }
}
