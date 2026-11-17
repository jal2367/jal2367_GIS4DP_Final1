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

function flyToComuna(map, name) {
  const keep = { pitch: map.getPitch(), bearing: map.getBearing(), duration: 1600 };
  const box = bounds[name];
  if (!box) {
    map.flyTo({ ...HOME, ...keep });
    return;
  }
  const camera = map.cameraForBounds(box, { padding: 80, bearing: map.getBearing() });
  if (camera) map.flyTo({ center: camera.center, zoom: camera.zoom, ...keep });
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
