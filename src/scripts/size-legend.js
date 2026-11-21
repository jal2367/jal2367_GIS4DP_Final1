// Graduated size legend for the Santiago Map and the story (in the
// page's accent colour): nested hexagons at 20%,
// 40%, 60%, 80% and 100% of full size, drawn at TRUE SCALE for the current
// zoom (at the map centre), with a ruler underneath in years.
//
// Sizes match public/data/Hexa_sized.geojson: 0 years = 20% of full width,
// 54+ years = 100%, linear in between. A full hexagon is 1,154.7 m wide
// (corner to corner) and 1,000 m tall (flat top to flat bottom).

const HEX_W_M = 1154.7;
const HEX_H_M = 1000;
const STEPS = [
  { size: 0.2, label: "0" },
  { size: 0.4, label: "13.5" },
  { size: 0.6, label: "27" },
  { size: 0.8, label: "40.5" },
  { size: 1.0, label: "54+" },
];
const MAX_PX = 180; // wider than this and the legend is shrunk (and says so); fits the side panel
const PAD = 8;
const SVG_NS = "http://www.w3.org/2000/svg";

function metresPerPixel(map) {
  const lat = map.getCenter().lat * (Math.PI / 180);
  return (40075016.686 * Math.cos(lat)) / (512 * Math.pow(2, map.getZoom()));
}

function el(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function render(map, box) {
  const svg = box.querySelector("svg");
  const note = box.querySelector("[data-scale-note]");
  if (!svg) return;
  // Draw in the page's accent colour (--map-accent, set in global.css).
  const accent = getComputedStyle(box).getPropertyValue("--map-accent").trim() || "#c2d96b";

  const trueW = HEX_W_M / metresPerPixel(map);
  const k = trueW > MAX_PX ? MAX_PX / trueW : 1;
  const W = trueW * k;
  const H = W * (HEX_H_M / HEX_W_M);

  const x0 = PAD;
  const cy = PAD + H / 2;
  const rulerY = PAD + H + 8;
  const width = Math.max(W + PAD * 2 + 24, 120);
  const height = rulerY + 26;
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.replaceChildren();

  // Nested flat-top hexagons sharing their left corner, largest first.
  for (const step of [...STEPS].reverse()) {
    const w = W * step.size, h = H * step.size;
    const pts = [
      [x0, cy], [x0 + w / 4, cy - h / 2], [x0 + (3 * w) / 4, cy - h / 2],
      [x0 + w, cy], [x0 + (3 * w) / 4, cy + h / 2], [x0 + w / 4, cy + h / 2],
    ].map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
    svg.appendChild(el("polygon", {
      points: pts, fill: accent, "fill-opacity": 0.12, stroke: accent, "stroke-width": 1,
    }));
  }

  // Ruler: a line the width of the full hexagon, a tick under each hexagon's
  // right corner, and year labels where there is room.
  svg.appendChild(el("line", { x1: x0, y1: rulerY, x2: x0 + W, y2: rulerY, stroke: accent, "stroke-width": 1 }));
  let lastLabelX = Infinity;
  for (const step of [...STEPS].reverse()) {
    const x = x0 + W * step.size;
    svg.appendChild(el("line", { x1: x, y1: rulerY - 3, x2: x, y2: rulerY + 3, stroke: accent, "stroke-width": 1 }));
    const isLast = step.size === 1;
    if (isLast || lastLabelX - x >= 26) {
      const text = el("text", {
        x: isLast ? x + 2 : x, y: rulerY + 15, "font-size": 10, fill: accent,
        "text-anchor": isLast ? "start" : "middle", "font-family": "sans-serif",
      });
      text.textContent = step.label;
      svg.appendChild(text);
      lastLabelX = x;
    }
  }

  if (note) {
    note.textContent = k < 1
      ? `Shown at 1:${(1 / k).toFixed(1)} of map scale (zoomed in too far to fit).`
      : "True scale at the map centre.";
  }
}

function wire(element) {
  const box = document.getElementById("size-legend");
  const map = element && element.getMap ? element.getMap() : null;
  if (!box || !map || box.dataset.wired) return;
  box.dataset.wired = "1";
  const draw = () => render(map, box);
  map.on("zoom", draw);
  map.on("move", draw);
  draw();
}

document.addEventListener("ml-map:load", (event) => wire(event.target));
document.querySelectorAll("ml-map").forEach((element) => wire(element));

// Hide the size legend when the "Hexagon size" checkbox is off.
document.addEventListener("ml-map:parameter-change", (event) => {
  const { key, value } = event.detail || {};
  const box = document.getElementById("size-legend");
  if (key === "sizes" && box) box.style.display = value ? "" : "none";
});
