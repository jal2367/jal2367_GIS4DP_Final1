// North arrow and scale bar (km), shared by every map on the site.
//   - Growth Periods and Hydrography: pinned to the bottom of the side panel
//     (src/scripts/map-panels.js calls buildCompass).
//   - The story: filled into any <div id="map-compass"> on the page.
// The north arrow is a circle with a line pointing north; it turns with the
// map, and clicking it points the map north. The scale bar shows a round
// distance and updates as the map zooms.

function niceDistance(maxM) {
  const pow = Math.pow(10, Math.floor(Math.log10(maxM)));
  for (const f of [5, 2, 1]) if (f * pow <= maxM) return f * pow;
  return pow;
}

export function buildCompass(map, maxPx = 140) {
  const box = document.createElement("div");
  box.className = "map-compass";

  const north = document.createElement("button");
  north.type = "button";
  north.className = "north-arrow";
  north.title = "North (click to point the map north)";
  north.setAttribute("aria-label", "North arrow: click to point the map north");
  north.innerHTML =
    `<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
       <circle cx="14" cy="14" r="11" fill="none" stroke="currentColor" stroke-width="1.5"/>
       <line x1="14" y1="14" x2="14" y2="1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
       <circle cx="14" cy="14" r="1.6" fill="currentColor"/>
     </svg>`;
  north.addEventListener("click", () => map.easeTo({ bearing: 0 }));

  const scale = document.createElement("div");
  scale.className = "scale-bar";
  const bar = document.createElement("div");
  bar.className = "scale-bar-line";
  const label = document.createElement("span");
  label.className = "scale-bar-label";
  scale.append(bar, label);
  box.append(north, scale);

  const update = () => {
    north.style.transform = `rotate(${-map.getBearing()}deg)`;
    // Ground distance across 100 px at the centre of the view (accounts for
    // the tilt; nearer the horizon things look smaller).
    const c = map.project(map.getCenter());
    const a = map.unproject([c.x - 50, c.y]);
    const b = map.unproject([c.x + 50, c.y]);
    const mPerPx = a.distanceTo(b) / 100;
    if (!isFinite(mPerPx) || mPerPx <= 0) return;
    const metres = niceDistance(mPerPx * maxPx);
    bar.style.width = `${Math.round(metres / mPerPx)}px`;
    label.textContent = `${metres / 1000} km`;
  };
  map.on("move", update);
  update();
  return box;
}

// Pages with a <div id="map-compass"> (the story): fill it once the map loads.
function wire(element) {
  const slot = document.getElementById("map-compass");
  const map = element && element.getMap ? element.getMap() : null;
  if (!slot || !map || slot.dataset.wired) return;
  slot.dataset.wired = "1";
  slot.appendChild(buildCompass(map, 120));
}
document.addEventListener("ml-map:load", (event) => wire(event.target));
document.querySelectorAll("ml-map").forEach((element) => wire(element));
