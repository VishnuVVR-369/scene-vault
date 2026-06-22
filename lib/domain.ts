import { z } from "zod";

export const nullableIdSchema = z.string().min(1).nullable();

export const folderSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  parentFolderId: nullableIdSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const sceneMetadataSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  folderId: nullableIdSchema,
  version: z.number().int().nonnegative(),
  currentObjectKey: z.string().min(1).nullable(),
  thumbnailObjectKey: z.string().min(1).nullable(),
  byteSize: z.number().int().nonnegative(),
  contentHash: z.string().min(1).nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  lastSavedAt: z.number().int().nonnegative().nullable(),
});

export const excalidrawFilesSchema = z.record(z.string(), z.unknown());

export const sceneBundleSchema = z.object({
  type: z.literal("excalidraw"),
  version: z.number().int().positive(),
  source: z.string().min(1),
  elements: z.array(z.unknown()),
  appState: z.record(z.string(), z.unknown()),
  files: excalidrawFilesSchema,
});

export const libraryStateSchema = z.object({
  ownerId: z.string().min(1),
  folders: z.array(folderSchema),
  scenes: z.array(sceneMetadataSchema),
  bundles: z.record(z.string(), sceneBundleSchema),
  // Local-mode only: PNG data-URL previews keyed by scene id. Remote mode keeps
  // its thumbnails in R2 (see `thumbnailObjectKey`), so this stays empty there.
  thumbnails: z.record(z.string(), z.string()).default({}),
});

export const createFolderInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  parentFolderId: nullableIdSchema,
});

export const renameFolderInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
});

export const moveFolderInputSchema = z.object({
  id: z.string().min(1),
  parentFolderId: nullableIdSchema,
});

export const createSceneInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  folderId: nullableIdSchema,
});

export const updateSceneInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120).optional(),
  folderId: nullableIdSchema.optional(),
});

export const saveSceneBundleInputSchema = z.object({
  sceneId: z.string().min(1),
  bundle: sceneBundleSchema,
  byteSize: z.number().int().nonnegative(),
  contentHash: z.string().min(1),
});

export const r2UploadRequestSchema = z.object({
  contentType: z.enum(["application/json", "application/vnd.excalidraw+json"]),
  byteSize: z.number().int().positive().max(25 * 1024 * 1024),
  contentHash: z.string().min(8).max(128),
});

export const signedStorageTargetSchema = z.object({
  key: z.string().min(1),
  url: z.string().url(),
});

export const sharedSceneMetadataSchema = z.object({
  sceneId: z.string().min(1),
  mode: z.enum(["view", "edit"]),
  title: z.string().trim().min(1).max(120),
  version: z.number().int().nonnegative(),
  hasScene: z.boolean(),
  hasThumbnail: z.boolean(),
  byteSize: z.number().int().nonnegative(),
  contentHash: z.string().min(1).nullable(),
  updatedAt: z.number().int().nonnegative(),
  lastSavedAt: z.number().int().nonnegative().nullable(),
});

export const convexFolderDocSchema = folderSchema.omit({ id: true }).extend({
  _id: z.string().min(1),
  _creationTime: z.number(),
});

export const convexSceneDocSchema = sceneMetadataSchema.omit({ id: true }).extend({
  _id: z.string().min(1),
  _creationTime: z.number(),
});

export const convexLibraryResponseSchema = z.object({
  folders: z.array(convexFolderDocSchema),
  scenes: z.array(convexSceneDocSchema),
});

export type Folder = z.infer<typeof folderSchema>;
export type SceneMetadata = z.infer<typeof sceneMetadataSchema>;
export type SceneBundle = z.infer<typeof sceneBundleSchema>;
export type LibraryState = z.infer<typeof libraryStateSchema>;
export type ConvexFolderDoc = z.infer<typeof convexFolderDocSchema>;
export type ConvexSceneDoc = z.infer<typeof convexSceneDocSchema>;
export type SharedSceneMetadata = z.infer<typeof sharedSceneMetadataSchema>;

export function createEmptySceneBundle(): SceneBundle {
  return {
    type: "excalidraw",
    version: 2,
    source: "scenevault",
    elements: [],
    appState: {
      viewBackgroundColor: "#ffffff",
    },
    files: {},
  };
}
