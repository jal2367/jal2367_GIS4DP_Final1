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
import { buildLayerRail, railGroups, railPills, railWidth } from "./layer-rail.js";

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
  // Into the Growth Periods section when there is one, else the left column.
  const target = sectionBody(left, "growth") || left;
  const mount = panel.parentElement; // the library's wrapper in its corner
  if (mount && mount.parentElement !== target) target.appendChild(mount);
  orderLeft(left);
}

// ---- Side panel sections (Santiago Map) ----
// Two foldable sections, each with its own accent colour (global.css) and an
// on/off switch tied to the layer rail's cards for that topic:
//   Growth Periods: comuna dropdown, period pills, size switch, size legend;
//   Hydrography: the natural / engineered sub-layer pills;
//   Base map: a pill per base layer (comunas, satellite, terrain);
//   Social and Puntos críticos: placeholders for layers still to come.
const SECTIONS = [
  // Placeholders (no data yet): a pill and a note; wire up when data arrives.
  // Placeholder groups: a pill per sub-layer card in the rail.
  { key: "social", title: "Social", pills: true, note: "Placeholder: social data to come." },
  { key: "criticos", title: "Puntos críticos", pills: true, note: "Placeholder: critical points to come." },
  { key: "hash", title: "Growth Patterns" },
  { key: "growth", title: "Growth Periods" },
  { key: "hydro", title: "Hydrography" },
  { key: "base", title: "Base map", pills: true },
];
function sectionBody(left, key) {
  return left.querySelector(`.panel-section[data-section="${key}"] > .panel-section-body`);
}
function buildSections(root) {
  const left = leftColumn(root);
  if (!left || left.querySelector(".panel-section") || !railGroups(root).length) return;
  for (const { key, title, pills, note } of SECTIONS) {
    const groups = () => railGroups(root).filter((g) => g.section === key);
    if (!groups().length) continue;
    const section = document.createElement("section");
    section.className = "panel-section";
    section.dataset.section = key;
    const head = document.createElement("div");
    head.className = "panel-section-head";
    // The title folds and unfolds the section without switching its layers.
    const name = document.createElement("button");
    name.type = "button";
    name.className = "panel-section-title";
    name.textContent = title;
    // On/off: an X when on that collapses into a line when off (global.css).
    const sw = document.createElement("button");
    sw.type = "button";
    sw.className = "panel-switch";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-label", `Show ${title}`);
    head.append(name, sw);
    const body = document.createElement("div");
    body.className = "panel-section-body";
    body.id = `panel-section-${key}`;
    sw.setAttribute("aria-controls", body.id);
    name.setAttribute("aria-controls", body.id);
    section.append(head, body);
    left.appendChild(section);

    // On if any of its layers are on. Switching off hides them all (the
    // section stays open, dimmed); switching on brings it back to how the
    // page opened (layers, sub-layers and, for Growth Periods, the comuna,
    // period and size controls). The title folds it, layers untouched.
    let folded = false;
    const setFolded = (f) => {
      folded = f;
      section.classList.toggle("is-folded", f);
      body.hidden = f;
      name.setAttribute("aria-expanded", String(!f));
      name.title = f ? `Open ${title}` : `Close ${title}`;
    };
    name.addEventListener("click", () => setFolded(!folded));
    const sync = () => {
      const on = groups().some((g) => g.isOn());
      sw.setAttribute("aria-checked", String(on));
      sw.title = on ? `Hide ${title}` : `Show ${title}`;
      section.classList.toggle("is-off", !on);
      // Switching off no longer folds the section: its pills stay, dimmed
      // (global.css .is-off). Only the title folds and unfolds it.
    };
    sw.addEventListener("click", () => {
      if (groups().some((g) => g.isOn())) {
        for (const g of groups()) g.setOn(false);
        return;
      }
      for (const g of groups()) g.reset();
      if (!groups().some((g) => g.isOn())) for (const g of groups()) g.setOn(true);
      if (key === "growth") resetGrowthControls(root);
    });
    root.addEventListener("rail-change", sync);
    sync();

    // A pill per layer group, styled like the other sections' pills.
    if (pills) {
      const row = document.createElement("div");
      row.className = "rail-pills";
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", title);
      const syncPills = [];
      if (note) row.classList.add("rail-pills-list"); // placeholder names are long
      for (const g of groups()) {
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "rail-pill";
        const dot = document.createElement("i");
        dot.style.background = "var(--map-accent)";
        pill.append(dot, document.createTextNode(g.label));
        pill.addEventListener("click", () => g.setOn(!g.isOn()));
        row.appendChild(pill);
        syncPills.push(() => pill.setAttribute("aria-pressed", String(g.isOn())));
      }
      const syncAll = () => syncPills.forEach((fn) => fn());
      root.addEventListener("rail-change", syncAll);
      syncAll();
      const wrap = document.createElement("div");
      wrap.className = "rail-pill-section";
      wrap.appendChild(row);
      if (note) {
        const p = document.createElement("p");
        p.className = "panel-section-note";
        p.textContent = note;
        wrap.appendChild(p);
      }
      body.appendChild(wrap);
    }
  }
}
// Growth Periods controls back to their defaults: all comunas, every period
// on, sizes on. Done through the panel's own inputs so the map and the
// buttons stay in step.
function resetGrowthControls(root) {
  const panel = root.querySelector(".ml-map-params");
  if (!panel) return;
  const select = root.querySelector(".rail-comuna select") || panel.querySelector("select");
  // The options are numbered; the first one is "All comunas".
  if (select && select.selectedIndex !== 0) {
    select.selectedIndex = 0;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  for (const box of panel.querySelectorAll('input[type="checkbox"]')) {
    if (box.closest(".ml-map-params-layer")) continue; // layer switches (hidden)
    if (!box.checked) box.click();
  }
}

// The comuna dropdown goes to the layer rail, right above the layer cards.
// (The library builds it in its panel; it keeps working from here.)
function comunaToRail(root) {
  const rail = root.querySelector(".layer-rail");
  const select = root.querySelector(".ml-map-params select");
  if (!rail || !select) return;
  const row = select.closest(".ml-map-params-row") || select.parentElement;
  let box = rail.querySelector(".rail-comuna");
  if (!box) {
    box = document.createElement("div");
    box.className = "rail-comuna";
    rail.insertBefore(box, rail.querySelector(".layer-rail-list"));
  }
  if (row.parentElement !== box) box.replaceChildren(row);
}

// Only the active group's section is shown in the side panel (the group
// picked in the layer rail).
function showActiveSection(root) {
  const left = leftColumn(root);
  if (!left || left.dataset.followsRail) return;
  if (!left.querySelector(".panel-section")) return;
  left.dataset.followsRail = "1";
  const show = () => {
    const key = root.dataset.activeSection || "growth";
    for (const sec of left.querySelectorAll(".panel-section")) {
      const current = sec.dataset.section === key;
      sec.classList.toggle("is-current", current);
      sec.hidden = !current;
    }
    left.scrollTop = 0;
  };
  root.addEventListener("rail-select", show);
  show();
}

// Comuna info panel: clicking a comuna on the map folds the side panel away
// and shows this panel in its place, with the comuna's growth summary and its
// winter critical points (SENAPRED 2026) by risk level. Its × (or picking a
// layer in the rail) brings the side panel back.
const RISK = ["Muy Alto", "Alto", "Medio", "Bajo"];
function inRing(x, y, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function inGeom(x, y, g) {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  return polys.some((p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h)));
}
function comunaPanel(root) {
  const map = root.getMap ? root.getMap() : null;
  const left = leftColumn(root);
  if (!map || !left || root.querySelector(".comuna-panel") || !map.getLayer("comunas-fill")) return;
  const panel = document.createElement("aside");
  panel.className = "comuna-panel";
  panel.setAttribute("aria-label", "Comuna");
  panel.hidden = true;
  root.appendChild(panel);

  const close = () => {
    panel.hidden = true;
    left.classList.remove("is-covered");
    left.inert = left.classList.contains("is-collapsed");
  };
  const row = (k, v) => `<div class="cp-row"><span>${k}</span><b>${v ?? "—"}</b></div>`;
  // An info group, its header in the colour of the layer it comes from
  // (data-section matches the rail's section colours).
  const cpOpen = {};
  const group = (section, title, body) => `
    <section class="cp-group" data-section="${section}">
      <button type="button" class="cp-group-head" aria-expanded="true">
        <span>${title}</span><i class="cp-sign" aria-hidden="true"></i></button>
      <div class="cp-group-body">${body}</div>
    </section>`;

  map.on("click", "comunas-fill", async (event) => {
    const f = event.features && event.features[0];
    if (!f) return;
    const p = f.properties;
    // Critical points inside this comuna, by risk level.
    let counts = null;
    const src = map.getSource("puntos_criticos");
    if (src && src.getData) {
      const data = await src.getData();
      const geom = (await map.getSource("comunas_lines")?.getData?.())?.features?.find((c) => c.properties.COMUNA === p.COMUNA)?.geometry;
      if (data && geom) {
        counts = Object.fromEntries(RISK.map((r) => [r, 0]));
        for (const pt of data.features) {
          const [x, y] = pt.geometry.coordinates;
          if (inGeom(x, y, geom)) counts[pt.properties.nivel] = (counts[pt.properties.nivel] || 0) + 1;
        }
      }
    }
    const total = counts ? RISK.reduce((a, r) => a + counts[r], 0) : null;
    panel.innerHTML = `
      <div class="cp-head"><h2>${p.COMUNA}</h2>
        <button type="button" class="cp-close" aria-label="Close comuna info" title="Close">×</button></div>
      ${group("growth", "Urbanization",
        row("Mean year", p.Mean_year) + row("Period", p.Period) +
        row("Years covered", `${p.First_year}–${p.Last_year}`) + row("Hexagons", p.Hexagons))}
      ${counts ? group("hash", "Puntos críticos (invierno 2026)",
        row("Total", total) + RISK.map((r) => row(r, counts[r])).join("")) : ""}`;
    panel.querySelector(".cp-close").addEventListener("click", close);
    // Each info group folds from its header (open/closed remembered while
    // the page is open).
    for (const sec of panel.querySelectorAll(".cp-group")) {
      const btn = sec.querySelector(".cp-group-head");
      const set = (open) => {
        sec.classList.toggle("is-closed", !open);
        btn.setAttribute("aria-expanded", String(open));
        cpOpen[sec.dataset.section] = open;
      };
      set(cpOpen[sec.dataset.section] !== false);
      btn.addEventListener("click", () => set(sec.classList.contains("is-closed")));
    }
    panel.hidden = false;
    left.classList.add("is-covered");
    left.inert = true;
  });
  // Picking a layer in the rail brings the side panel back.
  root.addEventListener("rail-select", close);
  root.addEventListener("click", (e) => { if (e.target.closest && e.target.closest(".rail-card-main")) close(); });
}

// Put each piece in its section.
function fillSections(root) {
  const left = leftColumn(root);
  if (!left) return;
  const growth = sectionBody(left, "growth");
  const hydro = sectionBody(left, "hydro");
  const legend = left.querySelector("#size-legend");
  if (growth && legend && legend.parentElement !== growth) growth.appendChild(legend);
  // Each group's sub-layer pills go to its own section (Hydrography, the
  // purple group...).
  const pills = railPills(root);
  if (!pills) return;
  for (const block of [...pills.querySelectorAll(".rail-pill-block")]) {
    const body = sectionBody(left, block.dataset.section);
    if (!body) continue;
    let wrap = body.querySelector(":scope > .rail-pill-section");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "rail-pill-section"; body.prepend(wrap); }
    wrap.appendChild(block);
  }
}

// Info box first, then controls, colour legend, size legend.
// The site wraps all its top-left boxes (info box, size legend) in one slot
// container; `display: contents` lets each box be ordered on its own.
function orderOf(el) {
  if (el.dataset && (el.dataset.section === "social" || el.dataset.section === "criticos" || el.dataset.section === "hash")) return 1;
  if (el.dataset && el.dataset.section === "growth") return 2;
  if (el.dataset && el.dataset.section === "hydro") return 3;
  if (el.dataset && el.dataset.section === "base") return 4;
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
    // The tab shows a short line (global.css), no arrow.
    left.inert = collapsed; // hidden panel is skipped by keyboard and screen readers
  };
  set(readCollapsed(), false);
  // Keep the map centred on the visible area when the window is resized.
  window.addEventListener("resize", () => updateLayout(root, false));
  const remember = (collapsed) => {
    try { localStorage.setItem(STORE_KEY, collapsed ? "1" : "0"); } catch { /* ignore */ }
  };
  tab.addEventListener("click", () => {
    const collapsed = !left.classList.contains("is-collapsed");
    set(collapsed);
    remember(collapsed);
  });
  // Clicking any layer card in the rail opens the panel if it was hidden.
  root.addEventListener("click", (event) => {
    if (!event.target.closest || !event.target.closest(".rail-card-main")) return;
    if (!left.classList.contains("is-collapsed")) return;
    set(false);
    remember(false);
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
  // Before the rail is built, its space is already reserved (global.css).
  const railX = root.querySelector(".layer-rail") ? railWidth(root)
    : parseFloat(getComputedStyle(root).getPropertyValue("--rail-x")) || 0;
  root.style.setProperty("--rail-x", `${railX}px`);
  if (!map || !left) return;
  const panelOpen = !left.classList.contains("is-collapsed");
  const headerH = left.offsetTop || 0; // the panel starts below the header
  const padding = { left: railX + (panelOpen ? left.offsetWidth : 0), top: headerH, right: 0, bottom: 0 };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  map.easeTo({ padding, duration: animate && !reduce ? 250 : 0 });
}

// North arrow and scale bar (src/scripts/map-compass.js): the panel's other
// contents scroll behind them.
// Pinned to the bottom of the layer rail when there is one, else of the
// side panel.
function mapFooter(root) {
  const host = root.querySelector(".layer-rail") || leftColumn(root);
  const map = root.getMap ? root.getMap() : null;
  const existing = root.querySelector(".side-panel-footer");
  // Built before the rail existed: move it into the rail.
  if (existing) { if (host && existing.parentElement !== host) host.appendChild(existing); return; }
  if (!host || !map) return;

  const footer = document.createElement("div");
  footer.className = "side-panel-footer";
  footer.appendChild(buildCompass(map));
  host.appendChild(footer);
}

function apply(root) {
  buildLayerRail(root, () => updateLayout(root));
  sidePanel(root);
  buildSections(root);
  fillSections(root);
  showActiveSection(root);
  comunaPanel(root);
  mapFooter(root);
  moveParamsLeft(root);
  comunaToRail(root);
  pillifyPeriods(root);
  inlineToggles(root);
  const left = leftColumn(root);
  if (left) orderLeft(left);
}

// Changes inside these redraw constantly (as the map moves) and never need
// the panels re-arranged, so they are ignored.
const IGNORE = "#size-legend, .map-compass, .rail-card, .maplibregl-canvas-container, .maplibregl-popup";
const watched = new WeakSet();
function watch(root) {
  if (!root) return;
  if (watched.has(root)) { apply(root); return; } // e.g. the map just finished loading
  watched.add(root);
  apply(root);
  // Re-apply when the library adds or rebuilds a panel, at most once a frame.
  let queued = false;
  new MutationObserver((mutations) => {
    if (queued || mutations.every((m) => m.target.closest && m.target.closest(IGNORE))) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(root); });
  }).observe(root, { childList: true, subtree: true });
  // The layer rail needs the map's layers: build it as soon as they exist.
  const map = root.getMap ? root.getMap() : null;
  if (map) {
    const ready = () => apply(root);
    if (map.isStyleLoaded && map.isStyleLoaded()) ready();
    map.once("load", ready);
    map.once("idle", ready);
  }
}

document.addEventListener("ml-map:load", (event) => watch(event.target));
document.querySelectorAll("ml-map").forEach((element) => watch(element));
