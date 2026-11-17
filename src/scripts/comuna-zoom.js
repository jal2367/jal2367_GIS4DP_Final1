// Fly the full page map to the comuna picked in the layer panel's "Comuna"
// dropdown. "All comunas" flies back to the opening view.
//
// The map fires `ml-map:parameter-change` when a dropdown changes; the event's
// target is the map element, and `getMap()` gives the MapLibre map.
// comuna-bounds.json holds each comuna's [[west, south], [east, north]],
// made from public/data/comunas.geojson.
import bounds from "../data/comuna-bounds.json";

// Keep in step with `center` and `zoom` in src/maps/full-page.yaml.
const HOME = { center: [-70.7, -33.47], zoom: 10.5 };

document.addEventListener("ml-map:parameter-change", (event) => {
  const { key, value } = event.detail || {};
  if (key !== "comuna") return;
  const map = event.target && event.target.getMap ? event.target.getMap() : null;
  if (!map) return;

  const keep = { pitch: map.getPitch(), bearing: map.getBearing(), duration: 1600 };
  const box = bounds[value];
  if (!box) {
    map.flyTo({ ...HOME, ...keep });
    return;
  }
  const camera = map.cameraForBounds(box, { padding: 80, bearing: map.getBearing() });
  if (camera) map.flyTo({ center: camera.center, zoom: camera.zoom, ...keep });
});
