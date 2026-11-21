// Layer rail (Santiago Map): a dark frosted panel on the far left with the
// site name and page links on top, then the map's layers drawn as a tilted,
// exploded stack, data on top and the basemap at the bottom. Each card draws
// that layer's real geometry; clicking a card shows or hides the layer on the
// map. Styled in src/styles/global.css (.layer-rail), set up by
// src/scripts/map-panels.js.

// Common footprint for every card, so the planes line up like one stack.
const BBOX = [-70.97, -33.66, -70.43, -33.28]; // west, south, east, north
const BEARING = -20; // the maps' bearing, so the drawings face the same way
const SQUASH = 0.42; // vertical squash of the tilted plane
const CARD_H = 104; // CSS px per card

// Period colours of the hexagons, as in src/maps/full-page.yaml.
const PERIODS = [
  [1840, "#9b00e8"],
  [1942.5, "#ff00ff"],
  [1985.666667, "#ff4d94"],
  [2014.4, "#ffa31a"],
  [Infinity, "#ffff00"],
];
const periodColor = (y) => PERIODS.find(([max]) => y < max)[1];

// The cards for each map, top to bottom. `layers` are map layer ids (a
// function for layers found by name); `draw` says what to draw and how.
const SATELLITE = { label: "Satellite", swatch: "#bfc3c8", section: "base", layers: ["satellite"], startOff: true, draw: { kind: "satellite" } };
const TERRAIN = { label: "Terrain", swatch: "#8fb0c8", section: "base", layers: ["hillshade"], terrain: true, draw: { kind: "terrain" } };
// Santiago Map (src/maps/full-page.yaml): growth, then hydrography, then
// the base layers. Hydrography colours as in the map file: aquamarines for
// natural water (deepest for rivers to palest for ravines), dark violets for
// engineered water (deepest for the collector network to palest for
// reservoirs). Cards with `parts` get a pill per part (in the side panel).
// `section` ties a card to a side-panel section (growth, hydro or base):
// its on/off switch and its colour.
const STACK = [
  {
    label: "Hexagons", swatch: ["#9b00e8", "#ffff00"], section: "growth",
    layers: (map) => map.getLayersOrder().filter((id) => id.startsWith("hexa-")),
    draw: { kind: "vector", layer: "hexa-sized-1680-1806", width: 0.6, glow: true, color: (p) => periodColor(p.Year_Mean) },
  },
  {
    label: "Natural features", swatch: ["#00d6a8", "#c9fff0"], section: "hydro",
    parts: [
      { label: "Rivers", color: "#00d6a8", layers: ["hydro-rivers", "hydro-rivers-glow"], drawLayer: "hydro-rivers", where: (p) => p.TIPO === "Rivers", width: 0.9 },
      { label: "Streams", color: "#7fffd4", layers: ["hydro-streams", "hydro-streams-glow"], drawLayer: "hydro-streams", where: (p) => p.TIPO === "Streams", width: 0.7 },
      { label: "Ravines", color: "#c9fff0", layers: ["hydro-ravines", "hydro-ravines-glow"], drawLayer: "hydro-ravines", where: (p) => p.TIPO === "Ravines", width: 0.4, alpha: 0.5 },
    ],
  },
  {
    label: "Engineered features", swatch: ["#9400d3", "#dba8ff"], section: "hydro",
    parts: [
      { label: "Collector", color: "#9400d3", layers: ["sistema-colector", "sistema-colector-glow"], drawLayer: "sistema-colector", width: 0.8 },
      { label: "Canals", color: "#b44cff", layers: ["hydro-canals", "hydro-canals-glow"], drawLayer: "hydro-canals", where: (p) => p.TIPO === "Canals", width: 0.6 },
      { label: "Reservoirs", color: "#dba8ff", layers: ["hydro-reservoirs", "hydro-reservoirs-glow"], drawLayer: "hydro-reservoirs", where: (p) => p.TIPO === "Reservoirs and ponds", width: 0.7 },
    ],
  },
  {
    label: "Comunas", swatch: "#9aa4ac", section: "base",
    layers: ["comunas-fill", "comunas-outline", "comunas-labels"],
    draw: { kind: "vector", layer: "comunas-outline", width: 0.7, color: () => "#b8c0c6" },
  },
  SATELLITE,
  TERRAIN,
];

// ---- geometry: lon/lat -> point on the tilted plane of a card ----

const mercX = (lon) => (lon + 180) / 360;
const mercY = (lat) => {
  const r = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
};
const X0 = mercX(BBOX[0]), X1 = mercX(BBOX[2]);
const Y0 = mercY(BBOX[3]), Y1 = mercY(BBOX[1]);
const SPAN = Math.max(X1 - X0, Y1 - Y0);
const THETA = (-BEARING * Math.PI) / 180; // clockwise on screen

function makeProjector(W, H) {
  const flat = (mx, my) => {
    const x = (mx - (X0 + X1) / 2) / SPAN;
    const y = (my - (Y0 + Y1) / 2) / SPAN;
    return [x * Math.cos(THETA) - y * Math.sin(THETA), (x * Math.sin(THETA) + y * Math.cos(THETA)) * SQUASH];
  };
  const corners = [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]].map(([a, b]) => flat(a, b));
  const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
  const scale = Math.min((W - 24) / (Math.max(...xs) - Math.min(...xs)), (H - 34) / (Math.max(...ys) - Math.min(...ys)));
  const cx = W / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * scale;
  const cy = H / 2 + 8 - ((Math.max(...ys) + Math.min(...ys)) / 2) * scale;
  const fromMerc = (mx, my, lift = 0) => {
    const [x, y] = flat(mx, my);
    return [cx + x * scale, cy + y * scale - lift];
  };
  return {
    lonLat: (lon, lat, lift) => fromMerc(mercX(lon), mercY(lat), lift),
    merc: fromMerc,
    corners: corners.map(([x, y]) => [cx + x * scale, cy + y * scale]),
  };
}

// The plane every card sits on: a faint outline with dashed guides running up
// and down from its side corners, which join the cards into one stack.
function drawPlane(ctx, proj, H) {
  const c = proj.corners;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  c.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([2, 3]);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  const left = c.reduce((a, b) => (b[0] < a[0] ? b : a));
  const right = c.reduce((a, b) => (b[0] > a[0] ? b : a));
  for (const [x] of [left, right]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.restore();
}

// ---- data ----

const jsonCache = new Map();
function getJSON(url) {
  if (!jsonCache.has(url)) jsonCache.set(url, fetch(url).then((r) => r.json()));
  return jsonCache.get(url);
}
function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
// The GeoJSON behind a map layer (the map library passes it in as data).
async function layerData(map, layerId) {
  const layer = map.getLayer(layerId);
  const src = layer && map.getSource(layer.source);
  if (!src) return null;
  if (src.getData) return src.getData();
  return typeof src._data === "string" ? getJSON(src._data) : src._data || null;
}
// Tiles covering the footprint at zoom z, drawn onto one canvas in web
// mercator; returns the canvas and its mercator extent.
async function mosaic(template, z, size) {
  const n = 2 ** z;
  const tx0 = Math.floor(X0 * n), tx1 = Math.floor(X1 * n);
  const ty0 = Math.floor(Y0 * n), ty1 = Math.floor(Y1 * n);
  const canvas = document.createElement("canvas");
  canvas.width = (tx1 - tx0 + 1) * size;
  canvas.height = (ty1 - ty0 + 1) * size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const jobs = [];
  for (let x = tx0; x <= tx1; x++) for (let y = ty0; y <= ty1; y++) {
    const url = template.replace("{z}", z).replace("{x}", x).replace("{y}", y);
    jobs.push(loadImage(url).then((img) => img && ctx.drawImage(img, (x - tx0) * size, (y - ty0) * size, size, size)));
  }
  await Promise.all(jobs);
  return { ctx, canvas, mx0: tx0 / n, my0: ty0 / n, mspan: (tx1 - tx0 + 1) / n, myspan: (ty1 - ty0 + 1) / n };
}
function sampler(m) {
  const data = m.ctx.getImageData(0, 0, m.canvas.width, m.canvas.height).data;
  return (mx, my) => {
    const px = Math.floor(((mx - m.mx0) / m.mspan) * m.canvas.width);
    const py = Math.floor(((my - m.my0) / m.myspan) * m.canvas.height);
    const i = (py * m.canvas.width + px) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
}

// ---- drawings ----

// Points closer than about half a pixel on the card are skipped: a card is
// ~200 px across, so the 24,000 hydrography lines need only a fraction of
// their points, which keeps drawing fast.
function strokeGeometry(ctx, proj, geom) {
  const line = (coords) => {
    let px = Infinity, py = Infinity;
    coords.forEach(([lon, lat], i) => {
      const [x, y] = proj.lonLat(lon, lat);
      if (!i) { ctx.moveTo(x, y); px = x; py = y; return; }
      if (Math.abs(x - px) + Math.abs(y - py) < 0.6 && i < coords.length - 1) return;
      ctx.lineTo(x, y); px = x; py = y;
    });
  };
  const t = geom && geom.type;
  if (t === "LineString") line(geom.coordinates);
  else if (t === "MultiLineString" || t === "Polygon") geom.coordinates.forEach(line);
  else if (t === "MultiPolygon") geom.coordinates.forEach((poly) => poly.forEach(line));
}

const groupCache = new WeakMap(); // data -> Map(key -> Map(colour -> geometries))
function groupedGeometries(data, spec) {
  let perData = groupCache.get(data);
  if (!perData) { perData = new Map(); groupCache.set(data, perData); }
  const key = `${spec.layer}|${spec.where}|${spec.color}`;
  let byColor = perData.get(key);
  if (byColor) return byColor;
  byColor = new Map();
  for (const f of data.features) {
    const p = f.properties || {};
    if (spec.where && !spec.where(p)) continue;
    const c = spec.color(p);
    if (!byColor.has(c)) byColor.set(c, []);
    byColor.get(c).push(f.geometry);
  }
  perData.set(key, byColor);
  return byColor;
}

async function drawVector(ctx, proj, map, spec) {
  const data = await layerData(map, spec.layer);
  if (!data || !data.features || !data.features.length) return false;
  ctx.lineWidth = spec.width;
  ctx.lineJoin = "round";
  // Group by colour so each colour is one path (sorted once per layer and
  // filter, then reused on every redraw).
  const byColor = groupedGeometries(data, spec);
  for (const [color, geoms] of byColor) {
    const path = new Path2D();
    geoms.forEach((g) => strokeGeometry(path, proj, g));
    // Neon glow, like the map's "-glow" layers: a wider, faint stroke under
    // the line (much cheaper than a canvas blur on thousands of lines).
    if (spec.glow) {
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = spec.width * 3.5;
      ctx.strokeStyle = color;
      ctx.stroke(path);
      ctx.globalAlpha = 1;
    }
    ctx.lineWidth = spec.width;
    ctx.strokeStyle = color;
    ctx.stroke(path);
  }
  return true;
}

// A card with parts draws only the parts switched on, each in its colour.
async function drawParts(ctx, proj, map, parts) {
  let ok = true;
  for (const part of parts) {
    if (!part.on) continue;
    const color = part.alpha ? hexAlpha(part.color, part.alpha) : part.color;
    const drew = await drawVector(ctx, proj, map, {
      layer: part.drawLayer, where: part.where, width: part.width, glow: true, color: () => color,
    });
    ok = ok && drew !== false;
  }
  return ok;
}
function hexAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

async function drawSatellite(ctx, proj, map) {
  const src = map.getSource("satellite");
  if (!src) return;
  // Tiles listed in the style, or a TileJSON link (MapTiler) to look them up.
  const template = src.tiles ? src.tiles[0] : src.url ? ((await getJSON(src.url)).tiles || [])[0] : null;
  if (!template) return;
  const m = await mosaic(template, 10, src.tileSize || 256);
  const sample = sampler(m);
  // Halftone: a dot per grid cell, sized by how bright the image is there.
  const COLS = 70, ROWS = 50;
  ctx.fillStyle = "rgba(201,205,210,0.8)";
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const mx = X0 + ((c + 0.5) / COLS) * (X1 - X0);
    const my = Y0 + ((r + 0.5) / ROWS) * (Y1 - Y0);
    const [R, G, B] = sample(mx, my);
    const lum = (0.3 * R + 0.59 * G + 0.11 * B) / 255;
    const rad = Math.min(0.9, lum * lum * 1.8);
    if (rad < 0.2) continue;
    const [x, y] = proj.merc(mx, my);
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
}

async function drawTerrain(ctx, proj, map) {
  const src = map.getSource("terrain");
  if (!src || !src.url) return;
  const tilejson = await getJSON(src.url);
  const template = tilejson.tiles && tilejson.tiles[0];
  if (!template) return;
  const m = await mosaic(template, 9, 512);
  const sample = sampler(m);
  const elev = (mx, my) => {
    const [R, G, B] = sample(mx, my);
    return -10000 + (R * 65536 + G * 256 + B) * 0.1;
  };
  // Wireframe mesh lifted by elevation.
  const COLS = 46, ROWS = 32, LIFT = 24 / 4000;
  const pts = [];
  for (let r = 0; r <= ROWS; r++) {
    pts.push([]);
    for (let c = 0; c <= COLS; c++) {
      const mx = X0 + (c / COLS) * (X1 - X0);
      const my = Y0 + (r / ROWS) * (Y1 - Y0);
      pts[r].push(proj.merc(mx, my, Math.max(0, elev(mx, my) - 400) * LIFT));
    }
  }
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = "rgba(143,176,200,0.75)";
  ctx.beginPath();
  for (let r = 0; r <= ROWS; r++) pts[r].forEach(([x, y], c) => (c ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  for (let c = 0; c <= COLS; c++) pts.forEach((row, r) => { const [x, y] = row[c]; r ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();
}

// Draws one card; resolves true once its layer's data was there to draw
// (false means "try again later", e.g. data still loading, rail not laid out).
async function drawCard(canvas, map, spec) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = CARD_H;
  if (!W) return false;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const proj = makeProjector(W, H);
  drawPlane(ctx, proj, H);
  // Keep each drawing on its plane (terrain may rise above it).
  if (spec.kind !== "terrain") {
    ctx.save();
    ctx.beginPath();
    proj.corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
  }
  let ok = true;
  try {
    if (spec.kind === "vector") ok = await drawVector(ctx, proj, map, spec);
    else if (spec.kind === "parts") ok = await drawParts(ctx, proj, map, spec.parts);
    else if (spec.kind === "satellite") await drawSatellite(ctx, proj, map);
    else if (spec.kind === "terrain") await drawTerrain(ctx, proj, map);
  } catch (err) {
    console.warn("Layer rail: could not draw", spec, err);
    ok = false;
  }
  if (spec.kind !== "terrain") ctx.restore();
  return ok !== false;
}

// ---- switching layers ----

function layerIds(map, group) {
  const ids = group.parts ? group.parts.flatMap((p) => p.layers)
    : typeof group.layers === "function" ? group.layers(map) : group.layers;
  return ids.filter((id) => map.getLayer(id));
}
function setGroupVisible(map, group, visible, savedTerrain) {
  for (const id of layerIds(map, group)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  if (group.terrain) map.setTerrain(visible ? savedTerrain : null);
}

// ---- the rail ----

/**
 * Builds the rail once for this map. `onLayout` is called once the rail
 * opens or closes, so the side panel and map centre can follow it.
 */
export function buildLayerRail(root, onLayout) {
  const map = root.getMap ? root.getMap() : null;
  if (!map || root.querySelector(".layer-rail")) return null;
  const stack = map.getLayer("comunas-fill") ? STACK : null;
  if (!stack) return null;
  const savedTerrain = map.getTerrain ? map.getTerrain() : null;

  const rail = document.createElement("aside");
  rail.className = "layer-rail";
  rail.id = "map-layer-rail";
  rail.setAttribute("aria-label", "Map layers");

  // Top of the rail: the site name and page links (the site header is
  // hidden on map pages, see global.css), then the rail's hide button.
  // Top of the rail: the links to the other pages (the site header is hidden
  // on this page, see global.css).
  // The rail stays open; its layer cards are always shown.
  const brand = document.createElement("div");
  brand.className = "rail-brand";
  // The site header's links to the other pages (already in order, this page
  // left out), side by side.
  const siteLinks = [...document.querySelectorAll("header .site-nav a")];
  if (siteLinks.length) {
    const nav = document.createElement("nav");
    nav.className = "site-nav rail-site-nav";
    nav.setAttribute("aria-label", "Pages");
    for (const a of siteLinks) nav.appendChild(a.cloneNode(true));
    brand.appendChild(nav);
  }

  const list = document.createElement("div");
  list.className = "layer-rail-list";

  rail.append(brand, list);
  root.appendChild(rail);

  const cards = [];
  // Every card's group, with isOn()/setOn() for the side panel's switches;
  // any change fires "rail-change" on the map element.
  rail.groups = [];
  const changed = () => root.dispatchEvent(new CustomEvent("rail-change"));
  // Sub-layer pills for the side panel (see mapPills below).
  const pillSection = document.createElement("div");
  pillSection.className = "rail-pill-section";
  rail.pillSection = pillSection;
  const isOn = (ids) => !ids.length || ids.some((id) => map.getLayoutProperty(id, "visibility") !== "none");
  for (const group of stack) {
    // A card: the drawing (a button that switches the whole group), and for
    // groups with parts, a row of pills that switch each part on its own.
    const card = document.createElement("div");
    card.className = "rail-card";
    // Colours the label like its side-panel section (global.css).
    if (group.section) card.dataset.section = group.section;
    const main = document.createElement("button");
    main.type = "button";
    main.className = "rail-card-main";
    main.title = `Show or hide: ${group.label}`;
    const label = document.createElement("span");
    label.className = "rail-card-label";
    const sw = document.createElement("i");
    // One colour, or two side by side for a card with two kinds of line.
    sw.style.background = Array.isArray(group.swatch)
      ? `linear-gradient(90deg, ${group.swatch[0]} 50%, ${group.swatch[1]} 50%)`
      : group.swatch;
    label.append(sw, document.createTextNode(group.label));
    const canvas = document.createElement("canvas");
    canvas.style.height = `${CARD_H}px`;
    canvas.setAttribute("aria-hidden", "true");
    main.append(canvas, label);
    card.appendChild(main);
    list.appendChild(card);
    // Layers that start hidden on this page (the style shares them with the story).
    if (group.startOff) setGroupVisible(map, group, false, savedTerrain);
    // On unless its layers are hidden (layers still loading count as on).
    main.setAttribute("aria-pressed", String(isOn(layerIds(map, group))));
    rail.groups.push(group);

    if (group.parts) {
      group.draw = { kind: "parts", parts: group.parts };
      const pills = document.createElement("div");
      pills.className = "rail-pills";
      pills.setAttribute("role", "group");
      pills.setAttribute("aria-label", group.label);
      const pillFor = new Map();
      for (const part of group.parts) {
        part.on = isOn(part.layers.filter((id) => map.getLayer(id)));
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "rail-pill";
        pill.setAttribute("aria-pressed", String(part.on));
        const dot = document.createElement("i");
        dot.style.background = part.color;
        dot.style.boxShadow = `0 0 5px ${part.color}`;
        pill.append(dot, document.createTextNode(part.label));
        pills.appendChild(pill);
        pillFor.set(part, pill);
        pill.addEventListener("click", () => {
          part.on = !part.on;
          setGroupVisible(map, { layers: part.layers }, part.on);
          sync();
          changed();
        });
      }
      // The pills live in the side panel (map-panels.js moves the section
      // there), under a heading per group.
      const head = document.createElement("div");
      head.className = "rail-pills-head";
      const hsw = document.createElement("i");
      hsw.style.background = sw.style.background;
      head.append(hsw, document.createTextNode(group.label));
      pillSection.append(head, pills);
      const sync = () => {
        for (const [part, pill] of pillFor) pill.setAttribute("aria-pressed", String(part.on));
        main.setAttribute("aria-pressed", String(group.parts.some((p) => p.on)));
        drawCard(canvas, map, group.draw);
      };
      group.isOn = () => group.parts.some((p) => p.on);
      // Back to how the page opened (each part as it started).
      for (const part of group.parts) part.initial = part.on;
      group.reset = () => {
        for (const part of group.parts) { part.on = part.initial; setGroupVisible(map, { layers: part.layers }, part.on); }
        sync();
        changed();
      };
      group.setOn = (on) => {
        for (const part of group.parts) { part.on = on; setGroupVisible(map, { layers: part.layers }, on); }
        sync();
        changed();
      };
    } else {
      group.isOn = () => main.getAttribute("aria-pressed") === "true";
      const initial = group.isOn();
      group.reset = () => group.setOn(initial);
      group.setOn = (on) => {
        main.setAttribute("aria-pressed", String(on));
        setGroupVisible(map, group, on, savedTerrain);
        changed();
      };
    }
    // The drawing switches the group: off if (any of) it is on, otherwise on.
    main.addEventListener("click", () => group.setOn(!group.isOn()));
    cards.push([canvas, group]);
  }
  // Draw once the rail is laid out (each canvas needs its width). Redraw when
  // the rail's width or the screen's pixel density changes, and retry any
  // card whose data was still loading each time the map settles.
  const drawn = new Set();
  let lastKey = "";
  // Cards are drawn one at a time, each when the browser is idle, so drawing
  // never freezes the page or the map while it loads.
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 50));
  let running = false;
  const drawAll = (force) => {
    const key = `${list.clientWidth}x${window.devicePixelRatio || 1}`;
    if (force || key !== lastKey) { drawn.clear(); lastKey = key; }
    if (running) return;
    running = true;
    const next = () => {
      const item = cards.find(([canvas]) => !drawn.has(canvas));
      if (!item) { running = false; return; }
      const [canvas, group] = item;
      drawn.add(canvas);
      drawCard(canvas, map, group.draw).then((ok) => {
        if (!ok) { drawn.delete(canvas); running = false; return; } // retry when the map settles
        idle(next);
      });
    };
    idle(next);
  };
  new ResizeObserver(() => drawAll(false)).observe(list);
  map.on("idle", () => { if (drawn.size < cards.length) drawAll(false); });
  drawAll(true);

  root.classList.add("has-layer-rail");
  onLayout && onLayout();
  return rail;
}

/** The rail's groups (each with label, section, isOn(), setOn()). */
export function railGroups(root) {
  const rail = root.querySelector(".layer-rail");
  return (rail && rail.groups) || [];
}

/** The sub-layer pill section built with the rail, to put in the side panel. */
export function railPills(root) {
  const rail = root.querySelector(".layer-rail");
  const section = rail && rail.pillSection;
  return section && section.childElementCount ? section : null;
}

/** How much of the map's left edge the rail covers right now (px). */
export function railWidth(root) {
  const rail = root.querySelector(".layer-rail");
  if (!rail) return 0;
  return rail.offsetWidth;
}
