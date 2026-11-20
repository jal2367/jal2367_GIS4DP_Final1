/**
 * A link to a page of this site that works under the GitHub Pages `base`
 * (astro.config.mjs): `url("hydrography")` → "/jal2367_GIS4DP_Final1/hydrography".
 * Use it for every internal link instead of writing the repository name.
 */
export function url(path = "") {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}
