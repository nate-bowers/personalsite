/**
 * A tiny non-React bus for "is the rail camera mid-flight right now?".
 *
 * The performance governor (FpsGovernor) must NOT escalate quality while a
 * buoy-to-buoy / home camera fly is underway: the heavy Tier-B geometry rebuild
 * (Terrain/Water re-tessellation) is synchronous and would land as a stall in
 * the middle of the animation. So CameraRig marks flights here and the governor
 * freezes its below-floor timer while a flight is in progress.
 *
 * Fail-open by design: isCameraFlying() auto-expires after maxMs so a flight
 * flag that is never cleared (a bug in CameraRig) can never permanently disable
 * the governor — the worst case is the governor resumes a few seconds late.
 */
let flying = false;
let startedAt = 0;

const now = () => (typeof performance !== "undefined" ? performance.now() : 0);

export function setCameraFlying(value: boolean) {
  flying = value;
  if (value) startedAt = now();
}

/** True only while a flight is genuinely underway (and within the watchdog window). */
export function isCameraFlying(maxMs = 6000): boolean {
  if (!flying) return false;
  if (now() - startedAt > maxMs) return false; // watchdog: a stuck flag can't wedge the governor
  return true;
}
