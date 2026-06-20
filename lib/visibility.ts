/**
 * Single switch for stations that aren't ready to show.
 *
 * The Ask Nate station (STN 0000) isn't built yet, so its buoy and nav entry are
 * hidden everywhere the site lists stations (3D buoys, static-tier buoys, the
 * index nav, and number-key nav). Its content (content/ask.md) and route (/ask)
 * are left intact, so flipping SHOW_ASK back to true brings the whole station
 * back with no other changes.
 */
export const SHOW_ASK = false;

/** Whether a station's buoy / nav entry should render. */
export const stationVisible = (slug: string): boolean => SHOW_ASK || slug !== "ask";
