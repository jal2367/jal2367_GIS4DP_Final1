// Map panels on Growth Periods and Hydrography:
//   1. moves the layer panel (comuna dropdown, period toggles, layer
//      checkboxes) from the top-right corner into the left column, so every
//      legend feature sits on the left, ordered: info box, controls, colour
//      legend, size legend;
//   2. turns the period checkboxes (labels like "1680–1806") into rounded
//      pill buttons with the period colour (styled in src/styles/global.css);
//   3. adds the layer rail on the far left (src/scripts/layer-rail.js); the
//      layer checkboxes it replaces are hidden in global.css.
// The library builds these panels itself, so this watches the map and
// re-applies whenever a panel appears or is rebuilt.

import { buildCompass } from "./map-compass.js";
import { buildLayerRail, railPills, railWidth } from "./layer-rail.js";

const PERIOD_COLORS = {
  "1680–1806": "#9b00e8",
  "1840–1941": "#ff00ff",
  "1943–1985": "#ff4d94",
  "1986–2013": "#ffa31a",
  "2014–2024": "#ffff00",
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
  if (el.classList.contains("rail-pill-section")) return 2;
  if (el.classList.contains("side-panel-footer")) return 9;
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
    swatch.style.boxShadow = `0 0 6px ${PERIOD_COLORS[caption.textContent.trim()]}`; // slight glow
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

// The left column as one continuous side panel (styled .side-panel in
// global.css), with a tab on its edge to hide and show it. The choice is
// remembered in this browser; on small screens the panel starts hidden.
const STORE_KEY = "mapSidePanelCollapsed";
function readCollapsed() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved !== null) return saved === "1";
  } catch { /* storage unavailable */ }
  return window.matchMedia("(max-width: 640px)").matches;
}
function sidePanel(root) {
  const left = leftColumn(root);
  if (!left || left.classList.contains("side-panel")) return;
  left.classList.add("side-panel");
  left.id = left.id || "map-side-panel";

  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "side-panel-tab";
  tab.setAttribute("aria-controls", left.id);
  left.parentElement.appendChild(tab);

  const set = (collapsed, animate = true) => {
    left.classList.toggle("is-collapsed", collapsed);
    updateLayout(root, animate);
    tab.classList.toggle("is-collapsed", collapsed);
    tab.setAttribute("aria-expanded", String(!collapsed));
    tab.setAttribute("aria-label", collapsed ? "Show panel" : "Hide panel");
    tab.title = collapsed ? "Show panel" : "Hide panel";
    tab.textContent = collapsed ? "›" : "‹";
    left.inert = collapsed; // hidden panel is skipped by keyboard and screen readers
  };
  set(readCollapsed(), false);
  // Keep the map centred on the visible area when the window is resized.
  window.addEventListener("resize", () => updateLayout(root, false));
  tab.addEventListener("click", () => {
    const collapsed = !left.classList.contains("is-collapsed");
    set(collapsed);
    try { localStorage.setItem(STORE_KEY, collapsed ? "1" : "0"); } catch { /* ignore */ }
  });
}

// Lay out the layer rail and side panel side by side (the panel starts where
// the rail ends, via --rail-x), then shift the map's centre into the part of
// the map they leave uncovered (and below the see-through site header), so
// the city stays in the middle of what you can see. MapLibre keeps this
// padding for later zooms and fly-tos too.
function updateLayout(root, animate = true) {
  const map = root.getMap ? root.getMap() : null;
  const left = leftColumn(root);
  const railX = railWidth(root);
  root.style.setProperty("--rail-x", `${railX}px`);
  if (!map || !left) return;
  const panelOpen = !left.classList.contains("is-collapsed");
  const headerH = left.offsetTop || 0; // the panel starts below the header
  const padding = { left: railX + (panelOpen ? left.offsetWidth : 0), top: headerH, right: 0, bottom: 0 };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  map.easeTo({ padding, duration: animate && !reduce ? 250 : 0 });
}

// North arrow and scale bar (src/scripts/map-compass.js), pinned to the
// bottom of the side panel: the panel's other contents scroll behind them.
function mapFooter(root) {
  const left = leftColumn(root);
  const map = root.getMap ? root.getMap() : null;
  if (!left || !map || left.querySelector(".side-panel-footer")) return;

  const footer = document.createElement("div");
  footer.className = "side-panel-footer";
  footer.appendChild(buildCompass(map));
  left.appendChild(footer);
}

function apply(root) {
  buildLayerRail(root, () => updateLayout(root));
  sidePanel(root);
  // Sub-layer pills (Hydrography) go in the side panel, under the info box.
  const pills = railPills(root);
  const leftCol = leftColumn(root);
  if (pills && leftCol && pills.parentElement !== leftCol) leftCol.appendChild(pills);
  mapFooter(root);
  moveParamsLeft(root);
  pillifyPeriods(root);
  inlineToggles(root);
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
