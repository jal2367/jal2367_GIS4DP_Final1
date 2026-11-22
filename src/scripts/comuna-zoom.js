// Fly the full page map to a comuna, when it is
//   - picked in the layer panel's "Comuna" dropdown ("All comunas" flies back
//     to the opening view), or
//   - clicked on the map (the invisible `comunas-fill` layer).
//
// The map element (<ml-map>) fires `ml-map:load` when the map is ready and
// `ml-map:parameter-change` when a dropdown changes; its `getMap()` gives the
// MapLibre map. comuna-bounds.json holds each comuna's
// [[west, south], [east, north]], made from public/data/comunas.geojson.
import bounds from "../data/comuna-bounds.json";

// Keep in step with `center` and `zoom` in src/maps/full-page.yaml.
const HOME = { center: [-70.7, -33.47], zoom: 10.5 };

// The map's left padding: the layer rail plus whichever panel is open
// beside it (the comuna info panel when a comuna is picked, which is twice
// the side panel's width, else the side panel), so the comuna is centred in
// the part of the window the panels leave open.
function leftPadding(map, comunaOpen) {
  const root = map.getContainer().closest("ml-map") || map.getContainer();
  const rail = root.querySelector(".layer-rail");
  const side = root.querySelector(".ml-map-chrome-top-left.side-panel");
  const railW = rail ? rail.offsetWidth : 0;
  if (comunaOpen) return railW + Math.min(520, window.innerWidth * 0.92);
  return railW + (side && !side.classList.contains("is-collapsed") ? side.offsetWidth : 0);
}

function flyToComuna(map, name) {
  const keep = { pitch: map.getPitch(), bearing: map.getBearing(), duration: 1600 };
  const box = bounds[name];
  const padding = { ...map.getPadding(), left: leftPadding(map, !!box) };
  if (!box) {
    map.flyTo({ ...HOME, ...keep, padding });
    return;
  }
  // Fit the comuna into the open area (padding animates with the flight).
  // (cameraForBounds already allows for the map's current padding, so only
  // the extra width the new panel takes is added.)
  const extra = Math.max(0, padding.left - map.getPadding().left);
  const camera = map.cameraForBounds(box, {
    padding: { top: 80, bottom: 80, left: 80 + extra, right: 80 },
    bearing: map.getBearing(),
  });
  // Centre on the comuna itself; the padding shifts it into the open area.
  const center = [(box[0][0] + box[1][0]) / 2, (box[0][1] + box[1][1]) / 2];
  map.flyTo({ center, zoom: camera ? camera.zoom : map.getZoom(), ...keep, padding });
}

// Highlight a clicked comuna's boundary (the "highlight" state in
// full-page.yaml). Needs maplibre-gl >= 5.6, which the site uses.
function setHighlight(map, name) {
  if (map.setGlobalStateProperty) map.setGlobalStateProperty("highlight", name);
}

const wired = new WeakSet();
function wire(element) {
  const map = element && element.getMap ? element.getMap() : null;
  if (!map || wired.has(map)) return;
  wired.add(map);
  map.on("click", "comunas-fill", (event) => {
    const feature = event.features && event.features[0];
    if (!feature) return;
    setHighlight(map, feature.properties.COMUNA);
    flyToComuna(map, feature.properties.COMUNA);
  });
}

document.addEventListener("ml-map:load", (event) => wire(event.target));
// In case the map finished loading before this script ran.
document.querySelectorAll("ml-map").forEach((element) => wire(element));

document.addEventListener("ml-map:parameter-change", (event) => {
  const { key, value } = event.detail || {};
  if (key !== "comuna") return;
  const map = event.target && event.target.getMap ? event.target.getMap() : null;
  if (!map) return;
  setHighlight(map, ""); // the dropdown choice is highlighted by its own state
  flyToComuna(map, value);
});
