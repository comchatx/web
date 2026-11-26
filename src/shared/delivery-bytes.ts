/**
 * A delivered object is held whole in memory by the root steward and by the command, so its size is
 * bounded where its time is not: a slow transfer that still moves is let run, and one that stops is
 * ended by the shared rclone runner's no-progress bound.
 */
export const OBJECT_DELIVERY_BYTES = 64 * 1024 * 1024;
export const SIDECAR_DELIVERY_BYTES = 1024 * 1024;
