/*
 * Near me — preview controller.
 *
 * Does exactly three things: pick a screen, pick a theme, and keep both in the URL so a
 * screenshot run (or a link in a review) can land on one state. No app imports, no
 * fetches, no storage.
 */
"use strict";

/** The screens, in review order. `label` is what the picker shows. */
const SCREENS = [
  { id: "home-unset",     label: "Home · no location set" },
  { id: "home-city",      label: "Home · Near you (same city)" },
  { id: "home-thin",      label: "Home · Near you (tier groups)" },
  { id: "home-empty",     label: "Home · nothing nearby" },
  { id: "picker",         label: "Picker · choose a city" },
  { id: "picker-dupe",    label: "Picker · six “Burgos”" },
  { id: "explore",        label: "Explore · filter + sort + groups" },
  { id: "explore-nosort", label: "Explore · Near me unavailable" },
  { id: "explore-empty",  label: "Explore · no results in that city" },
  { id: "map",            label: "Explore · map open (city markers)" },
  { id: "map-fail",       label: "Explore · map tiles failed" },
];

/* Which top tab is lit per screen. */
const TAB_FOR_SCREEN = (id) => (id.startsWith("explore") || id.startsWith("map") ? "explore" : "home");

/*
 * The chosen city per screen. Without this the location chip read "Makati City" on the
 * `home-thin` screen while the shelf beneath it said "In Pila" — the two halves of the same
 * fixture disagreeing, which is exactly the kind of thing a reviewer would (rightly) read as
 * a design error rather than a preview bug.
 */
const CITY_FOR_SCREEN = {
  "home-city": "Makati City",
  "home-thin": "Pila",
  "home-empty": "Burgos",
};

const FIXTURES = {
  cityLabel: (screen) => CITY_FOR_SCREEN[screen] || "Makati City",
  popularMeta: (screen) => `Most booked in ${CITY_FOR_SCREEN[screen] || "Makati City"} this month`,
};

function setScreen(id) {
  const screen = SCREENS.some((s) => s.id === id) ? id : SCREENS[0].id;

  /* A section is on when its `data-screen` list contains this screen. */
  document.querySelectorAll(".screen").forEach((el) => {
    const owns = (el.dataset.screen || "").split(/\s+/).includes(screen);
    el.classList.toggle("is-on", owns);
  });

  /* Inside a section, `data-only` narrows an element to specific screens. */
  document.querySelectorAll("[data-only]").forEach((el) => {
    const owns = (el.dataset.only || "").split(/\s+/).includes(screen);
    el.classList.toggle("is-on", owns);
  });

  document.querySelectorAll("[data-fixture]").forEach((el) => {
    const fill = FIXTURES[el.dataset.fixture];
    if (fill) el.textContent = fill(screen);
  });

  const tab = TAB_FOR_SCREEN(screen);
  document.querySelectorAll(".tb-tab").forEach((el) => {
    el.classList.toggle("is-on", el.dataset.tab === tab);
  });

  document.getElementById("pv-screen").value = screen;
  sync({ screen });
}

function setTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  document.getElementById("pv-theme").value = next;
  sync({ theme: next });
}

/* Keep the URL in step so a state can be linked or screenshotted directly. */
function sync(patch) {
  const url = new URL(window.location.href);
  Object.entries(patch).forEach(([k, v]) => url.searchParams.set(k, v));
  window.history.replaceState(null, "", url);
}

function init() {
  const picker = document.getElementById("pv-screen");
  SCREENS.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    picker.appendChild(opt);
  });

  const params = new URLSearchParams(window.location.search);
  setTheme(params.get("theme") || "light");
  setScreen(params.get("screen") || SCREENS[0].id);

  /* `chrome=off` hides the preview bar — used by the screenshot run. */
  if (params.get("chrome") === "off") document.body.classList.add("pv-hidden");

  picker.addEventListener("change", (e) => setScreen(e.target.value));
  document.getElementById("pv-theme").addEventListener("change", (e) => setTheme(e.target.value));

  /* The location line and the map toggle walk to the obvious next state. */
  document.querySelectorAll(".locchip").forEach((el) =>
    el.addEventListener("click", () => setScreen("picker")),
  );
  document.querySelectorAll(".maptoggle").forEach((el) =>
    el.addEventListener("click", () =>
      setScreen(document.getElementById("pv-screen").value === "map" ? "explore" : "map"),
    ),
  );
  document.querySelectorAll(".opt").forEach((el) =>
    el.addEventListener("click", () => setScreen("home-city")),
  );
  document.querySelectorAll(".sheet-x").forEach((el) =>
    el.addEventListener("click", () => setScreen("home-city")),
  );
}

document.addEventListener("DOMContentLoaded", init);
