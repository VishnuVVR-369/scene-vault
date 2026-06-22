import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Sweep stale presence/sessions and garbage-collect rooms whose live working
// set has already been snapshotted back to R2. Dirty rooms are never collected,
// so edits survive even if every browser disconnects before snapshotting.
crons.interval("sweep collab rooms", { seconds: 60 }, internal.collab.sweep, {});

export default crons;
