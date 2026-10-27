/*
 * The preview controller — generic, app-independent, synced into every preview as
 * `controller.js`. Do not edit the copy; edit `_shared/controller.js`.
 *
 * Does four things and nothing else: pick a screen, pick a theme, keep both in the URL, and
 * tell the screenshot runner when a render has finished.
 *
 * ⚠️ A CLASSIC SCRIPT, NOT AN ES MODULE, and this is not a style choice: Chromium blocks
 * `import` over `file://` as a cross-origin request, so a module-based preview cannot open
 * without a server — which is the one thing a preview must not need. Each file therefore
 * assigns to a global and `index.html` loads them in order:
 *
 *   controller.js  → window.PV_BOOT
 *   chrome.js      → window.PV        (app chrome helpers)
 *   screens.js     → window.PREVIEW_SCREENS = [{ id, label, render }]
 *
 * The runner reads `window.PREVIEW_SCREENS` straight off the page, so the screen list lives in
 * exactly one place and `preview.json` never restates it.
 */
"use strict";

(function () {
  /** Render one screen into #root and light the matching picker option. */
  function setScreen(id) {
    const screens = window.PREVIEW_SCREENS || [];
    const screen = screens.find((s) => s.id === id) || screens[0];
    if (!screen) throw new Error("No screens: screens.js must set window.PREVIEW_SCREENS");

    const root = document.getElementById("root");
    root.innerHTML = screen.render();
    const picker = document.getElementById("pv-screen");
    if (picker) picker.value = screen.id;
    sync({ screen: screen.id });
    wire();

    /*
     * Optional `mount(root)` — anything a screen cannot express as a static string: a scroll
     * position indicator, a measurement, a listener on something `data-goto` does not cover.
     *
     * ⚠️ Called AFTER the DOM is in place and after `wire()`, and never retained: the next
     * `setScreen` replaces `innerHTML`, which discards the nodes and every listener attached
     * to them. So a mount must not register anything outside `root` that it cannot survive
     * losing — put listeners on elements inside `root`, not on `document`.
     */
    if (typeof screen.mount === "function") screen.mount(root);
  }

  /** `.dark` on <html> — the mechanism all three web apps use. Never `data-theme`. */
  function setTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.classList.toggle("dark", dark);
    const picker = document.getElementById("pv-theme");
    if (picker) picker.value = dark ? "dark" : "light";
    sync({ theme: dark ? "dark" : "light" });
  }

  /* Keep the URL in step so one state can be linked or screenshotted directly. */
  function sync(patch) {
    const url = new URL(window.location.href);
    Object.entries(patch).forEach(([k, v]) => url.searchParams.set(k, v));
    window.history.replaceState(null, "", url);
  }

  /*
   * Any element with `data-goto="<screen id>"` walks to that screen. This is what lets a
   * preview's own buttons move between states without each screen wiring its own listeners —
   * re-run after every render, because the DOM it binds to was just replaced.
   */
  function wire() {
    document.querySelectorAll("[data-goto]").forEach((el) => {
      el.addEventListener("click", () => setScreen(el.dataset.goto));
    });
  }

  function boot() {
    const screens = window.PREVIEW_SCREENS || [];
    const picker = document.getElementById("pv-screen");
    if (picker) {
      screens.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.label;
        picker.appendChild(opt);
      });
      picker.addEventListener("change", (e) => setScreen(e.target.value));
    }
    const themePicker = document.getElementById("pv-theme");
    if (themePicker) themePicker.addEventListener("change", (e) => setTheme(e.target.value));

    const params = new URLSearchParams(window.location.search);
    setTheme(params.get("theme") || "light");
    setScreen(params.get("screen") || (screens[0] && screens[0].id));

    /* `chrome=off` hides the preview bar — the screenshot run always passes it. */
    if (params.get("chrome") === "off") document.body.classList.add("pv-hidden");

    /* The runner waits on this instead of a per-preview selector, so "ready" means the same
       thing in every preview and no preview has to declare what to wait for. */
    document.documentElement.dataset.pvReady = "1";
  }

  window.PV_BOOT = boot;
  document.addEventListener("DOMContentLoaded", boot);
})();
