/*
 * dark-lift-command — the command Users page, rendered under four dark palettes.
 *
 * Every screen is the SAME markup. Only the `data-opt` on the wrapper changes, and
 * `preview.css` maps each value onto a set of `--rs-*` overrides under `.dark` — so light mode
 * is identical in all four on purpose (this proposal changes dark only).
 *
 * ⚠️ command has no `_shared/command.js` chrome yet (see `_shared/command.css`), so the shell
 * is written here. It is the first command preview — the shell below is what a future
 * `_shared/command.js` would be extracted from once a second preview repeats it.
 *
 * Fixtures are INVENTED — no real user, vendor or staff rows.
 */
"use strict";

(function () {
  const { esc, each, icon, card, button } = window.PV;

  const OPTIONS = [
    { id: "current", label: "Current · as shipped",
      title: "Current — as shipped",
      note: "Cards are 2.8% white over the page: 1.05:1 against it. Containers read as outlines only." },
    { id: "a", label: "A · Brighter base",
      title: "Option A — brighter base",
      note: "Every surface one step lighter; cards stay translucent. Card vs page 1.08:1. Shared palette: costs five booker tile labels under 4.5:1." },
    { id: "b", label: "B · Lifted containers (recommended)",
      title: "Option B — lifted containers · recommended",
      note: "Page unchanged. Sidebar, cards and panels become opaque, lighter surfaces. Card vs page 1.13:1, panels 1.25:1. No contrast regressions." },
    { id: "c", label: "C · Brighter base + lifted containers (chosen)",
      title: "Option C — brighter base + lifted containers",
      note: "CHOSEN 2026-10-21. Page one step lighter; cards a stronger see-through white (5.5%) so cards nested in cards stay lighter than what they sit on. Card vs page 1.13:1, panels 1.29:1. Five booker tile labels nudged lighter." },
  ];

  const NAV = ["Dashboard", "Users", "Vendors", "Roles", "KYC review", "Audit log"];

  const STATS = [
    { k: "Active users", v: "1,284", d: "+42 this week" },
    { k: "Vendors", v: "96", d: "4 awaiting KYC" },
    { k: "Portal grants", v: "311", d: "across 3 apps" },
  ];

  const USERS = [
    { n: "Ana Reyes",    e: "ana.reyes@example.com",   role: "Booker",       st: "active",   sl: "Active" },
    { n: "Marco Lim",    e: "marco@sample-studio.test", role: "Vendor admin", st: "active",   sl: "Active" },
    { n: "Jessa Cruz",   e: "jessa.cruz@example.com",  role: "Vendor staff", st: "invited",  sl: "Invited" },
    { n: "Paolo Santos", e: "paolo.s@example.com",     role: "Ops",          st: "disabled", sl: "Disabled" },
  ];

  const banner = (o) => `
    <div class="dl-banner" role="note">
      <p class="dl-banner-title">${esc(o.title)}</p>
      <p class="dl-banner-note">${esc(o.note)} Light mode is unchanged in every option.</p>
    </div>`;

  const shell = (body, active) => `
    <div class="rs-page csh">
      <nav class="rs-sidebar csh-nav">
        <p class="csh-brand">RS <span>Command</span></p>
        ${each(NAV, (n) => `<p class="csh-navitem${n === active ? " is-on" : ""}">${esc(n)}</p>`)}
      </nav>
      <div class="csh-main">
        <div class="rs-topbar csh-topbar">
          <span class="csh-title">${esc(active)}</span>
          <span class="rs-pill csh-pill">ops@example.com</span>
        </div>
        <div class="csh-body">${body}</div>
      </div>
    </div>`;

  const stats = () => `
    <div class="dl-stats">
      ${each(STATS, (s) => card(`
        <p class="dl-stat-k">${esc(s.k)}</p>
        <p class="dl-stat-v">${esc(s.v)}</p>
        <p class="dl-stat-d">${esc(s.d)}</p>`, "rs-card"))}
    </div>`;

  const table = () => card(`
    <div class="dl-filter">
      <div class="rs-input dl-search">${icon("search", 15)}<span>Search name or email</span></div>
      ${button("Invite user", { primary: true })}
    </div>
    <div class="dl-rows">
      ${each(USERS, (u) => `
        <div class="rs-table-row dl-row">
          <span class="dl-avatar" aria-hidden="true">${esc(u.n.slice(0, 1))}</span>
          <span class="dl-who"><b>${esc(u.n)}</b><span>${esc(u.e)}</span></span>
          <span class="rs-pill dl-role">${esc(u.role)}</span>
          <span class="dl-badge" data-st="${esc(u.st)}">${esc(u.sl)}</span>
        </div>`)}
    </div>`, "rs-card dl-table");

  const detail = () => card(`
    <p class="dl-card-title">Marco Lim</p>
    <p class="dl-detail-sub">Vendor admin · Sample Studio</p>
    <div class="rs-sub dl-sub">
      <p><span>Vendor portal</span><b>Granted</b></p>
      <p><span>Booker portal</span><b>Granted</b></p>
      <p><span>Command</span><b>—</b></p>
    </div>
    <div class="rs-panel dl-panel" role="menu" aria-label="Row actions (sample)">
      <p class="dl-panel-item">Change role…</p>
      <p class="dl-panel-item">Revoke vendor portal</p>
    </div>`, "rs-card");

  const body = (o) => `
    ${banner(o)}
    ${stats()}
    <div class="dl-grid">
      <div class="dl-col">${table()}</div>
      <div class="dl-col dl-col-side">${detail()}</div>
    </div>`;

  window.PREVIEW_SCREENS = OPTIONS.map((o) => ({
    id: o.id,
    label: o.label,
    render: () => `<div class="dl" data-opt="${o.id}">${shell(body(o), "Users")}</div>`,
  }));
})();
