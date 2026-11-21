// Findings page (the story): a dark side panel on the far left like the
// Explore page's layer rail, with the page links on top, the chapter
// progress (the story's chapter dots, labelled with each chapter's title)
// and, at the bottom, the size legend, north arrow and scale bar. Styled in
// src/styles/global.css (.story-panel).
//
// The panel lives inside <ml-scrollytelling> so the story keeps updating the
// chapter dots it moves there.

function chapterTitles(story) {
  const titles = {};
  for (const section of story.querySelectorAll(".scrolly-chapter")) {
    const h = section.querySelector(".chapter-title");
    if (section.dataset.chapterId && h) titles[section.dataset.chapterId] = h.textContent.trim();
  }
  return titles;
}

function build(story) {
  if (story.querySelector(".story-panel")) return true;
  const markers = story.querySelector(".chapter-markers");
  const legend = document.getElementById("size-legend");
  if (!markers || !legend) return false;

  const panel = document.createElement("aside");
  panel.className = "story-panel";
  panel.setAttribute("aria-label", "Story");

  // Page links from the (hidden) site header.
  const links = document.querySelector("header .site-nav");
  if (links) {
    const top = document.createElement("div");
    top.className = "rail-brand";
    const nav = links.cloneNode(true);
    nav.classList.add("rail-site-nav");
    top.appendChild(nav);
    panel.appendChild(top);
  }

  // Chapter progress: the story's own dots, each with its chapter's title.
  const progress = document.createElement("div");
  progress.className = "story-progress";
  const titles = chapterTitles(story);
  for (const m of markers.querySelectorAll(".chapter-marker")) {
    if (m.querySelector(".chapter-marker-label")) continue;
    const label = document.createElement("span");
    label.className = "chapter-marker-label";
    label.textContent = titles[m.dataset.chapterId] || m.getAttribute("aria-label") || "";
    m.appendChild(label);
  }
  progress.appendChild(markers);
  panel.appendChild(progress);

  // Size legend, north arrow and scale bar at the bottom.
  const foot = document.createElement("div");
  foot.className = "story-panel-foot";
  foot.appendChild(legend);
  panel.appendChild(foot);

  story.appendChild(panel);
  story.classList.add("has-story-panel");

  // Keep the camera centred on the part of the map the panel leaves open.
  const map = story.querySelector("ml-map")?.getMap?.();
  if (map) map.setPadding({ left: panel.offsetWidth, top: 0, right: 0, bottom: 0 });
  return true;
}

function watch(story) {
  if (build(story)) return;
  const obs = new MutationObserver(() => { if (build(story)) obs.disconnect(); });
  obs.observe(story, { childList: true, subtree: true });
}

document.querySelectorAll("ml-scrollytelling").forEach(watch);
document.addEventListener("ml-map:load", () => document.querySelectorAll("ml-scrollytelling").forEach(watch));
