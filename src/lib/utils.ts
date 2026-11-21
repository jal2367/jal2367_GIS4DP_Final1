/**
 * A link to a page of this site that works under the GitHub Pages `base`
 * (astro.config.mjs): `url("scrollytelling")` → "/jal2367_GIS4DP_Final1/scrollytelling".
 * Use it for every internal link instead of writing the repository name.
 */
export function url(path = "") {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}
