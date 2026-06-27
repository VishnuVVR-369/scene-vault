/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as collab from "../collab.js";
import type * as collabAuth from "../collabAuth.js";
import type * as collabDb from "../collabDb.js";
import type * as collabLogic from "../collabLogic.js";
import type * as crons from "../crons.js";
import type * as library from "../library.js";
import type * as testSeed from "../testSeed.js";
import type * as validation from "../validation.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  collab: typeof collab;
  collabAuth: typeof collabAuth;
  collabDb: typeof collabDb;
  collabLogic: typeof collabLogic;
  crons: typeof crons;
  library: typeof library;
  testSeed: typeof testSeed;
  validation: typeof validation;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
