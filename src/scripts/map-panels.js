// Map panels on Growth Periods and Hydrography:
//   1. moves the layer panel (comuna dropdown, period toggles, layer
//      checkboxes) from the top-right corner into the left column, so every
//      legend feature sits on the left, ordered: info box, controls, colour
//      legend, size legend;
//   2. turns the period checkboxes (labels like "1680–1806") into rounded
//      pill buttons with the period colour (styled in src/styles/global.css).
// The library builds these panels itself, so this watches the map and
// re-applies whenever a panel appears or is rebuilt.

const PERIOD_COLORS = {
  "1680–1806": "#00204d",
  "1840–1941": "#314e55",
  "1943–1985": "#617d5c",
  "1986–2013": "#92ab64",
  "2014–2024": "#c2d96b",
};

function leftColumn(root) {
  return root.querySelector(".ml-map-chrome-top-left");
}

function moveParamsLeft(root) {
  const panel = root.querySelector(".ml-map-params");
  const left = leftColumn(root);
  if (!panel || !left) return;
  const mount = panel.parentElement; // the library's wrapper in its corner
  if (mount && mount.parentElement !== left) left.appendChild(mount);
  orderLeft(left);
}

// Info box first, then controls, colour legend, size legend.
// The site wraps all its top-left boxes (info box, size legend) in one slot
// container; `display: contents` lets each box be ordered on its own.
function orderOf(el) {
  if (el.querySelector(".ml-map-params")) return 2;
  if (el.classList.contains("ml-map-legend") || el.querySelector(".maplibre-legend")) return 3;
  if (el.id === "size-legend" || el.querySelector("#size-legend")) return 4;
  return 1;
}
function orderLeft(left) {
  for (const child of left.children) {
    if (child.classList.contains("ml-astro-slot")) {
      child.style.display = "contents";
      for (const box of child.children) box.style.order = String(orderOf(box));
    } else {
      child.style.order = String(orderOf(child));
    }
  }
}

function pillifyPeriods(root) {
  const panel = root.querySelector(".ml-map-params");
  if (!panel || panel.querySelector(".period-pills")) return;
  const rows = [...panel.querySelectorAll("label.ml-map-params-row")].filter((row) => {
    const caption = row.querySelector(".ml-map-params-label");
    return caption && PERIOD_COLORS[caption.textContent.trim()] && row.querySelector('input[type="checkbox"]');
  });
  if (!rows.length) return;
  const group = document.createElement("div");
  group.className = "period-pills";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Periods");
  rows[0].before(group);
  for (const row of rows) {
    const caption = row.querySelector(".ml-map-params-label");
    const swatch = document.createElement("span");
    swatch.className = "period-swatch";
    swatch.style.background = PERIOD_COLORS[caption.textContent.trim()];
    row.classList.add("period-pill");
    row.style.cssText = ""; // drop the library's block layout
    caption.style.cssText = "";
    row.prepend(swatch);
    group.appendChild(row);
  }
}

// Other checkbox controls (e.g. "Average years of development"): checkbox before the label on
// one line, like the layer checkboxes, instead of the label above it.
function inlineToggles(root) {
  const panel = root.querySelector(".ml-map-params");
  if (!panel) return;
  for (const row of panel.querySelectorAll("label.ml-map-params-row:not(.period-pill):not(.ml-map-params-layer)")) {
    const input = row.querySelector(':scope > input[type="checkbox"]');
    const caption = row.querySelector(":scope > .ml-map-params-label");
    if (!input || !caption || row.dataset.inline) continue;
    row.dataset.inline = "1";
    row.style.cssText = "display:flex;gap:6px;align-items:center;margin:4px 0;";
    caption.style.cssText = "font-weight:600;";
    row.prepend(input);
  }
}

// Layer checkboxes double as the legend: a line swatch in the layer's colour
// next to its name (Hydrography layers; comuna boundaries on both maps).
// Keep the colours in step with the layers' line-color in the map YAML.
const LAYER_SWATCHES = {
  "Ravines (quebradas)": { color: "#5f8fa8", dashed: true },
  "Reservoirs and ponds": { color: "#9ad0f5" },
  "Canals": { color: "#7fdcc4" },
  "Streams (esteros)": { color: "#6fc3ea" },
  "Rivers": { color: "#3fa9f5", thick: true },
  "Collector network": { color: "#f2a541" },
  "Comuna boundaries": { color: "#9aa4ac" },
};

function layerSwatches(root) {
  const panel = root.querySelector(".ml-map-params");
  if (!panel) return;
  for (const row of panel.querySelectorAll("label.ml-map-params-layer")) {
    if (row.querySelector(".layer-swatch")) continue;
    const caption = row.querySelector("span:not(.layer-swatch)");
    const swatch = caption && LAYER_SWATCHES[caption.textContent.trim()];
    if (!swatch) continue;
    const line = document.createElement("span");
    line.className = "layer-swatch";
    line.style.borderTop = `${swatch.thick ? 4 : 2}px ${swatch.dashed ? "dashed" : "solid"} ${swatch.color}`;
    caption.before(line);
  }
}

function apply(root) {
  moveParamsLeft(root);
  pillifyPeriods(root);
  inlineToggles(root);
  layerSwatches(root);
  const left = leftColumn(root);
  if (left) orderLeft(left);
}

const watched = new WeakSet();
function watch(root) {
  if (!root || watched.has(root)) return;
  watched.add(root);
  apply(root);
  // Batch changes (the size legend redraws as the map moves) to once a frame.
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(root); });
  }).observe(root, { childList: true, subtree: true });
}

document.addEventListener("ml-map:load", (event) => watch(event.target));
document.querySelectorAll("ml-map").forEach((element) => watch(element));
