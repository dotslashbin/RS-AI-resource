/*
 * dark-lift-vendor — one vendor dashboard, rendered under four dark palettes.
 *
 * Every screen is the SAME markup. Only the `data-opt` on the wrapper changes, and
 * `preview.css` maps each value onto a set of `--sp-*` overrides under `.dark` — so light mode
 * is identical in all four on purpose (this proposal changes dark only).
 *
 * The banner at the top of each screen is a preview annotation, not part of the design: it is
 * dashed and labelled so it cannot be mistaken for app chrome.
 *
 * Fixtures are INVENTED — no real vendor, staff or customer rows.
 */
"use strict";

(function () {
  const { esc, each, card, field, button } = window.PV;

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

  const STATS = [
    { k: "Today's bookings", v: "12", d: "+3 vs yesterday" },
    { k: "Revenue this week", v: "₱18,450", d: "8 paid · 2 pending" },
    { k: "Awaiting approval", v: "3", d: "Oldest 2 h ago" },
    { k: "Staff on shift", v: "5", d: "of 7 scheduled" },
  ];

  const ROWS = [
    { t: "09:00", who: "Ana Reyes",     what: "Deep tissue · 60 min",  st: "confirmed", sl: "Confirmed" },
    { t: "10:30", who: "Marco Lim",     what: "Haircut + wash",        st: "pending",   sl: "Pending" },
    { t: "11:15", who: "Jessa Cruz",    what: "Facial · 45 min",       st: "progress",  sl: "In progress" },
    { t: "13:00", who: "Paolo Santos",  what: "Foot spa",              st: "cancelled", sl: "Cancelled" },
  ];

  const banner = (o) => `
    <div class="dl-banner" role="note">
      <p class="dl-banner-title">${esc(o.title)}</p>
      <p class="dl-banner-note">${esc(o.note)} Light mode is unchanged in every option.</p>
    </div>`;

  const stats = () => `
    <div class="dl-stats">
      ${each(STATS, (s) => card(`
        <p class="dl-stat-k">${esc(s.k)}</p>
        <p class="dl-stat-v">${esc(s.v)}</p>
        <p class="dl-stat-d">${esc(s.d)}</p>`, "sp-card dl-stat"))}
    </div>`;

  const table = () => card(`
    <div class="dl-card-head">
      <p class="dl-card-title">Upcoming bookings</p>
      <span class="sp-pill dl-chip">Today</span>
    </div>
    <div class="dl-rows">
      ${each(ROWS, (r) => `
        <div class="dl-row">
          <span class="dl-time">${esc(r.t)}</span>
          <span class="dl-who"><b>${esc(r.who)}</b><span>${esc(r.what)}</span></span>
          <span class="dl-badge" data-st="${esc(r.st)}">${esc(r.sl)}</span>
        </div>`)}
    </div>`, "sp-card dl-table");

  const form = () => card(`
    <p class="dl-card-title">Walk-in booking</p>
    <div class="dl-form">
      ${field("Customer name", "", { placeholder: "e.g. Ana Reyes", inputCls: "sp-input", id: "name" })}
      ${field("Service", "Deep tissue · 60 min", { inputCls: "sp-input", id: "svc" })}
    </div>
    <div class="sp-sub dl-sub">
      <p><span>Subtotal</span><b>₱1,200.00</b></p>
      <p><span>Kiosk fee</span><b>₱0.00</b></p>
    </div>
    <div class="dl-actions">${button("Cancel")}${button("Create booking", { primary: true })}</div>`, "sp-card");

  const panel = () => `
    <div class="sp-panel dl-panel" role="menu" aria-label="Notifications (sample)">
      <p class="dl-card-title">Notifications</p>
      <p class="dl-panel-item">Marco Lim requested 10:30 tomorrow</p>
      <p class="dl-panel-item">Payout of ₱9,800 sent to BDO ••42</p>
    </div>`;

  const body = (o) => `
    ${banner(o)}
    ${stats()}
    <div class="dl-grid">
      <div class="dl-col">${table()}</div>
      <div class="dl-col dl-col-side">${form()}${panel()}</div>
    </div>`;

  window.PREVIEW_SCREENS = OPTIONS.map((o) => ({
    id: o.id,
    label: o.label,
    render: () => `<div class="dl" data-opt="${o.id}">${PVA.shell(body(o), { active: "Dashboard" })}</div>`,
  }));
})();
