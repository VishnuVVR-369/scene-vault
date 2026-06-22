import { z } from "zod";

const nullableIdSchema = z.string().min(1).nullable();

export const createFolderArgsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  parentFolderId: nullableIdSchema,
});

export const renameFolderArgsSchema = z.object({
  folderId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
});

export const moveFolderArgsSchema = z.object({
  folderId: z.string().min(1),
  parentFolderId: nullableIdSchema,
});

export const createSceneArgsSchema = z.object({
  title: z.string().trim().min(1).max(120),
  folderId: nullableIdSchema,
});

export const updateSceneArgsSchema = z.object({
  sceneId: z.string().min(1),
  title: z.string().trim().min(1).max(120).optional(),
  folderId: nullableIdSchema.optional(),
});

export const idArgsSchema = z.object({
  id: z.string().min(1),
});

export const commitSceneSaveArgsSchema = z.object({
  sceneId: z.string().min(1),
  objectKey: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  contentHash: z.string().min(1),
  thumbnailObjectKey: z.union([z.string().min(1), z.null()]).optional(),
});

export const shareModeSchema = z.enum(["view", "edit"]);

export const shareTokenSchema = z
  .string()
  .trim()
  .min(24)
  .max(160)
  .regex(/^[A-Za-z0-9_-]+$/);

export const shareTokenArgsSchema = z.object({
  token: shareTokenSchema,
});

export const sceneShareArgsSchema = z.object({
  sceneId: z.string().min(1),
  mode: shareModeSchema,
});

export const setSceneShareEnabledArgsSchema = sceneShareArgsSchema.extend({
  enabled: z.boolean(),
});

export const commitSharedSceneSaveArgsSchema = z.object({
  token: shareTokenSchema,
  objectKey: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  contentHash: z.string().min(1),
  thumbnailObjectKey: z.union([z.string().min(1), z.null()]).optional(),
});
