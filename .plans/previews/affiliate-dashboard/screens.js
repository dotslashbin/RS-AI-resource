/*
 * affiliate-dashboard — the screens. THIS FILE IS THE WORK; everything else is scaffolding.
 *
 * Decisions drawn (`.plans/2026-11-02-affiliate-dashboard-discovery.md`):
 *   Q34 / Q35  share = 1% of Ezzy's fee AFTER TAX; all rates snapshotted on the line
 *   Q4b      a flagged (disputed) booking freezes its line → "Held"
 *   Q4e      paid-but-not-completed bookings show as "Upcoming", labelled as estimates
 *   Q10      invite only — no sign-up anywhere in the shell
 *   Q12      vendor name, status, signup + activation dates; own lines only. No vendor
 *            contact details, NO booker data.
 *   Q23–Q25  a Payout column, a reference per line, earned-to-date per vendor
 *   Q16      customise the referral code (Settings)
 *   Q42–Q50  WITHDRAWALS replace monthly payouts: available 7 days after completion, whole
 *            balance, a Command-set minimum, Requested → Processing → Completed
 *
 * ⚠️ affiliate has no `_shared/*.js` chrome (as command), so the shell is written here.
 *
 * Fixtures are INVENTED. "Today" is Wed 4 Nov 2026; fee 11%; a SAMPLE 12% tax; rate 1% of the
 * after-tax fee. Every amount is computed from the booking amount, and every total is the sum
 * of the lines it names.
 */
"use strict";

(function () {
  const { esc, each, card, button } = window.PV;

  /* lucide-react glyphs not in base.js's set (layout-dashboard, store, receipt, wallet, copy,
     settings, link). */
  const GLYPH = {
    overview: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    vendors:  '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>',
    lines:    '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    payouts:  '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    copy:     '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    link:     '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  };
  GLYPH.withdraw = GLYPH.payouts; // lucide `wallet`
  const glyph = (name, size = 15) =>
    `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPH[name]}</svg>`;

  const peso = (n) => `₱${Math.abs(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const signed = (n) => (n < 0 ? `−${peso(n)}` : peso(n));

  /* ── fixtures ──────────────────────────────────────────────────────────────────────────── */
  /*
   * The money rule (discovery Q34, Q35, 2026-11-13):
   *   Ezzy's fee  = booking × FEE_PCT            (11%, configurable in Command)
   *   after tax   = fee × (1 − TAX_PCT)          (a fixed rate, configurable in Command)
   *   your share  = after tax × rate             (default 1%, overridable per affiliate)
   * All three percentages are snapshotted on the line when the booking completes.
   * ⚠️ TAX_PCT = 12 is a SAMPLE for drawing. The real rate starts unset (Q41).
   */
  const ME = { name: "Rina Dela Paz", email: "rina@example.com", code: "RINAREFERS", rate: 1 };
  const FEE_PCT = 11;
  const TAX_PCT = 12;
  const r2 = (n) => Math.round(n * 100) / 100;

  const VENDORS = [
    { n: "Kalye Padel Club",     st: "active",  sl: "Active",             up: "12 Aug 2026", act: "19 Aug 2026" },
    { n: "Bayside Yoga Loft",    st: "active",  sl: "Active",             up: "3 Sep 2026",  act: "10 Sep 2026" },
    { n: "Northpoint Futsal",    st: "active",  sl: "Active",             up: "21 Sep 2026", act: "2 Oct 2026" },
    { n: "Studio Sampaguita",    st: "active",  sl: "Active",             up: "8 Oct 2026",  act: "15 Oct 2026" },
    { n: "Lakeview Pickleball",  st: "pending", sl: "Pending activation", up: "28 Oct 2026", act: "" },
    { n: "Harbour Swim School",  st: "suspended", sl: "Suspended",        up: "2 Jul 2026",  act: "9 Jul 2026" },
  ];

  /*
   * One row per commission line; fee, after-tax fee and share are COMPUTED from the booking
   * amount by the rule above, so no figure can disagree with another.
   * `ref` is the line's own reference (Q24) — never a booking reference (Q12).
   * `w` is the Withdrawal column (Q23 as adapted by Q42): when the line becomes available
   * (7 days after the booking completed), or the withdrawal it was paid in.
   * The adjustment is the one exception: its fee is the CORRECTED fee (₱132, was ₱176) and its
   * share is the difference (1.16 − 1.55). It is dated by the correction, not the booking.
   */
  const line = (ref, d, v, amt, kind, w, note = "", o = {}) => {
    const fee = o.fee ?? r2((amt * FEE_PCT) / 100);
    const net = r2(fee * (1 - TAX_PCT / 100));
    const share = o.share ?? r2((net * ME.rate) / 100);
    return { ref, d, v, amt, fee, net, share, kind, w, note };
  };
  const LINES = [
    line("C-10482", "12 Nov 2026", "Kalye Padel Club",  1600, "upcoming",  "—"),
    line("C-10479", "9 Nov 2026",  "Northpoint Futsal", 2400, "upcoming",  "—"),
    line("C-10471", "3 Nov 2026",  "Bayside Yoga Loft", 850,  "earned",    "Available 10 Nov"),
    line("C-10468", "2 Nov 2026",  "Studio Sampaguita", 3500, "held",      "On hold"),
    line("C-10463", "1 Nov 2026",  "Kalye Padel Club",  1600, "earned",    "Available 8 Nov"),
    line("C-10460", "31 Oct 2026", "Kalye Padel Club",  1600, "adjust",    "Available now", "Fee on the 14 Oct booking (C-10397) corrected from ₱176.00 · comes off your balance", { fee: 132, share: -0.39 }),
    line("C-10452", "29 Oct 2026", "Northpoint Futsal", 2400, "earned",    "Available 5 Nov"),
    line("C-10447", "27 Oct 2026", "Bayside Yoga Loft", 850,  "cancelled", "—", "Refunded before it was withdrawn"),
    line("C-10441", "26 Oct 2026", "Kalye Padel Club",  1600, "available", "Available now"),
    line("C-10418", "20 Oct 2026", "Studio Sampaguita", 3500, "paid",      "W-1007 · 29 Oct"),
    line("C-10397", "14 Oct 2026", "Kalye Padel Club",  1600, "paid",      "W-1007 · 29 Oct"),
    line("C-10396", "14 Oct 2026", "Bayside Yoga Loft", 850,  "writeoff",  "W-1007 · 29 Oct", "Refunded after it was withdrawn · not taken back"),
  ];

  const KIND = {
    upcoming:  { label: "Upcoming · estimate",  explain: "Paid, not yet completed. Not money you have earned yet — the booking can still be cancelled or refunded." },
    earned:    { label: "Earned · not yet available", explain: "Completed. It becomes available to withdraw 7 days after the booking completed, on the date shown." },
    available: { label: "Available",            explain: "Ready to withdraw. It is included the next time you withdraw." },
    held:      { label: "Held · flagged",       explain: "The booking was flagged. The line is frozen until Ezzy resolves it: completed restores it, a refund cancels it." },
    cancelled: { label: "Cancelled",            explain: "Refunded or cancelled before it was withdrawn. Nothing is owed." },
    adjust:    { label: "Adjustment",           explain: "Ezzy corrected the fee on a booking. The difference is added to, or taken from, your balance." },
    paid:      { label: "Withdrawn",            explain: "Included in a withdrawal that Ezzy has sent." },
    writeoff:  { label: "Withdrawn · written off", explain: "Refunded after you withdrew it. Recorded on your receipt, never taken back." },
  };

  const sum = (kinds, rows = LINES) => r2(rows.filter((l) => kinds.includes(l.kind)).reduce((a, l) => a + l.share, 0));
  /* ⚠️ MIN is a SAMPLE. The real minimum is a Command setting that starts unset (Q45). */
  const MIN = 5;
  const AVAILABLE = sum(["available", "adjust"]); // 1.16 on 4 Nov
  const PENDING = sum(["earned"]);                 // 4.69, all available by 10 Nov
  const READY = r2(AVAILABLE + PENDING);           // 5.85 a week later
  const UPCOMING = sum(["upcoming"]);
  const HELD = sum(["held"]);
  /* "Earned to date" per vendor (Q25): the affiliate's own lines only, excluding estimates, held and cancelled. */
  const earnedFor = (name) => sum(["earned", "available", "paid", "writeoff", "adjust"], LINES.filter((l) => l.v === name));

  /* ── shell (copied from command's Sidebar / TabBar shape; affiliate's own copy later) ──── */
  const NAV = [
    { id: "overview", label: "Overview" },
    { id: "vendors",  label: "Vendors" },
    { id: "lines",    label: "Commission" },
    { id: "withdraw", label: "Withdraw" },
  ];
  /* Settings sits apart from the four main sections: sidebar "Account" group on desktop, a gear
     in the top bar below 860px (a fifth tab does not fit 390px — README F10). */
  const SETTINGS_NAV = { id: "settings", label: "Settings" };

  const navBtn = (n, active, cls) => `
    <button type="button" class="${cls}${n.id === active ? " is-on" : ""}" data-goto="${n.id}"${n.id === active ? ' aria-current="page"' : ""}>
      ${glyph(n.id)}<span>${esc(n.label)}</span>
    </button>`;

  const shell = (active, title, sub, body) => `
    <div class="rs-page af">
      <aside class="rs-sidebar af-side">
        <div class="af-brand">
          <span class="af-logo" aria-hidden="true">E</span>
          <span><b>Ezzy Affiliate</b></span>
        </div>
        <nav class="af-nav" aria-label="Main">
          ${each(NAV, (n) => navBtn(n, active, "af-navitem"))}
          <p class="af-navlabel">Account</p>
          ${navBtn(SETTINGS_NAV, active, "af-navitem")}
        </nav>
        <div class="af-user">
          <span class="af-avatar" aria-hidden="true">${esc(ME.name.slice(0, 1))}</span>
          <span class="af-user-text"><b>${esc(ME.name)}</b><span>${esc(ME.email)}</span></span>
        </div>
      </aside>
      <div class="af-main">
        <header class="rs-topbar af-top">
          <span class="af-top-brand"><span class="af-logo" aria-hidden="true">E</span><b>Ezzy Affiliate</b></span>
          <span class="rs-pill af-rate">Your rate · ${ME.rate}% of Ezzy's fee after tax</span>
          <button type="button" class="af-gear${active === "settings" ? " is-on" : ""}" data-goto="settings" aria-label="Settings"${active === "settings" ? ' aria-current="page"' : ""}>${glyph("settings", 18)}</button>
        </header>
        <nav class="rs-tabbar af-tabs" aria-label="Main">
          ${each(NAV, (n) => navBtn(n, active, "af-tab"))}
        </nav>
        <main class="af-body">
          <div class="af-head">
            <h1 class="af-title">${esc(title)}</h1>
            ${sub ? `<p class="af-sub">${esc(sub)}</p>` : ""}
          </div>
          ${body}
        </main>
      </div>
    </div>`;

  /* ── pieces ────────────────────────────────────────────────────────────────────────────── */
  const badge = (kind) => `<span class="af-badge" data-kind="${kind}">${esc(KIND[kind].label)}</span>`;
  const vbadge = (v) => `<span class="af-badge" data-vst="${v.st}">${esc(v.sl)}</span>`;

  /* `accent` = the 3px top + bottom rules, coloured from vendor's StatCard palette
     (`vendor/components/dashboard/FinancialSummary/FinancialSummary.tsx`); see preview.css. */
  const kpi = (k, v, d, tone, accent) => `
    <div class="pvc rs-card af-kpi" data-accent="${accent}">
      <p class="af-kpi-k">${esc(k)}</p>
      <p class="af-kpi-v"${tone ? ` data-tone="${tone}"` : ""}>${esc(v)}</p>
      <p class="af-kpi-d">${esc(d)}</p>
    </div>`;

  const shareCell = (l) => {
    if (l.kind === "upcoming") return `<span class="af-est">≈ ${peso(l.share)}</span>`;
    if (l.kind === "cancelled") return `<s>${peso(l.share)}</s>`;
    return signed(l.share);
  };

  /* A real <table>; under 640px each row reflows into a card using the `data-label`s.
     The compact form (overview) hides every `c-amt` column (the three amounts, withdrawal) and the
     reference, which sits under the vendor name so the vendor column keeps its width. */
  const linesTable = (rows, { full = false } = {}) => `
    <table class="af-table${full ? " is-full" : ""}">
      <thead><tr>
        <th scope="col">Booking date</th><th scope="col">Vendor${full ? " · reference" : ""}</th>
        <th scope="col" class="num c-amt">Booking</th><th scope="col" class="num c-amt">Ezzy's fee</th>
        <th scope="col" class="num c-amt">After tax</th>
        <th scope="col" class="num">Your share</th><th scope="col" class="c-amt">Withdrawal</th><th scope="col">Status</th>
      </tr></thead>
      <tbody>
        ${each(rows, (l) => `
          <tr data-kind="${l.kind}">
            <td data-label="Booking date" class="af-date-cell">${esc(l.d)}</td>
            <td data-label="Vendor"><b>${esc(l.v)}</b>${full ? `<span class="af-note"><span class="af-ref">${esc(l.ref)}</span>${l.note ? ` · ${esc(l.note)}` : ""}</span>` : ""}</td>
            <td data-label="Booking" class="num c-amt">${peso(l.amt)}</td>
            <td data-label="Ezzy's fee" class="num c-amt">${peso(l.fee)}</td>
            <td data-label="After tax" class="num c-amt">${peso(l.net)}</td>
            <td data-label="Your share" class="num af-share">${shareCell(l)}</td>
            <td data-label="Withdrawal" class="c-amt af-payout">${esc(l.w)}</td>
            <td data-label="Status">${badge(l.kind)}</td>
          </tr>`)}
      </tbody>
    </table>`;

  /* The balance against the minimum. A native <progress>, so the fill needs no inline style. */
  const meter = (value) => `<progress class="af-meter" max="${MIN}" value="${Math.min(Math.max(value, 0), MIN)}" aria-label="Progress to the minimum withdrawal">${peso(value)} of ${peso(MIN)}</progress>`;
  const balanceCard = ({ amount, pending, cta }) => card(`
    <div class="af-card-head">
      <div><p class="af-card-title">Available to withdraw</p>
        <p class="af-card-sub">Minimum withdrawal ${peso(MIN)}</p></div>
      <p class="af-big">${peso(amount)}</p>
    </div>
    ${meter(amount)}
    <p class="af-fine">${amount >= MIN ? "You have reached the minimum." : `${peso(r2(MIN - amount))} more to reach the minimum.`}${pending ? ` ${peso(pending)} more becomes available by 10 Nov.` : ""}</p>
    ${cta}`, "rs-card");

  /* ── screens ───────────────────────────────────────────────────────────────────────────── */
  const overview = () => {
    return shell("overview", "Overview", `Hello, ${ME.name.split(" ")[0]}. Here is what your referrals have earned.`, `
      <div class="af-kpis">
        ${kpi("Available to withdraw", peso(AVAILABLE), `Minimum ${peso(MIN)}`, "", "payout")}
        ${kpi("Earned · not yet available", peso(PENDING), "3 lines, all available by 10 Nov", "", "vendors")}
        ${kpi("Upcoming · estimate", `≈ ${peso(UPCOMING)}`, "2 paid bookings, not yet completed", "est", "upcoming")}
        ${kpi("Held", peso(HELD), "1 flagged booking, waiting on Ezzy", "held", "held")}
      </div>
      <div class="af-grid">
        <div class="af-col">
          ${balanceCard({ amount: AVAILABLE, pending: PENDING, cta: `<div class="af-code-actions">${button("Go to Withdraw", { goto: "withdraw" })}</div>` })}
          ${card(`
            <div class="af-card-head">
              <p class="af-card-title">Recent commission</p>
              ${button("View all", { goto: "lines" })}
            </div>
            ${linesTable(LINES.slice(0, 5))}`, "rs-card")}
        </div>
        <div class="af-col af-col-side">
          ${card(`
            <div class="af-card-head">
              <p class="af-card-title">Your vendors</p>
              ${button("View all", { goto: "vendors" })}
            </div>
            <ul class="af-vlist">
              ${each(VENDORS.slice(0, 5), (v) => `
                <li><span class="af-vname">${esc(v.n)}</span>${vbadge(v)}</li>`)}
            </ul>`, "rs-card")}
          ${card(`
            <p class="af-card-title">How you earn</p>
            <p class="af-fine">You earn ${ME.rate}% of Ezzy's fee after tax on every completed booking at a vendor you referred, for as long as the vendor stays on Ezzy. Nothing is earned before the vendor is activated. Nothing is sent to you until you withdraw.</p>
            <p class="af-fine af-example"><b>Example.</b> A ₱1,600.00 booking: Ezzy's fee is ₱176.00, which is ₱154.88 after tax, so you earn ₱1.55.</p>`, "rs-card")}
        </div>
      </div>`);
  };

  const vendors = () => shell("vendors", "Vendors", "Vendors who signed up with your referral code.", `
    ${card(`
      <div class="af-code">
        <div><p class="af-kpi-k">Your referral code</p><p class="af-code-v">${esc(ME.code)}</p></div>
        <div class="af-code-actions">
          <button type="button" class="pvb af-copy">${glyph("copy", 14)}<span>Copy code</span></button>
          ${button("Change code", { goto: "settings" })}
        </div>
      </div>`, "rs-card")}
    ${card(`
      <table class="af-table af-vtable">
        <thead><tr>
          <th scope="col">Vendor</th><th scope="col">Status</th><th scope="col">Signed up</th>
          <th scope="col">Activated</th><th scope="col" class="num">Earned to date</th>
        </tr></thead>
        <tbody>
          ${each(VENDORS, (v) => `
            <tr data-vst="${v.st}">
              <td data-label="Vendor"><b>${esc(v.n)}</b></td>
              <td data-label="Status">${vbadge(v)}</td>
              <td data-label="Signed up">${esc(v.up)}</td>
              <td data-label="Activated">${v.act ? esc(v.act) : '<span class="af-muted">Not yet</span>'}</td>
              <td data-label="Earned to date" class="num">${earnedFor(v.n) ? peso(earnedFor(v.n)) : '<span class="af-muted">—</span>'}</td>
            </tr>`)}
        </tbody>
      </table>
      <p class="af-fine af-legend-note"><b>Pending activation</b>: Ezzy is still reviewing the vendor; commission starts with their first completed booking after activation. <b>Suspended</b>: the vendor cannot take bookings, so nothing new is earned. Contact details are not shown.</p>`, "rs-card")}`);

  /*
   * ── Commission filters: booking-date range + status ──────────────────────────────────
   * The date filter copies vendor's `components/ui/DateRangeFilter/DateRangeFilter.tsx`:
   * a card with a titled "Showing …" caption, a row of presets, two native date fields, and an "All dates" chip because
   * a list's normal state is unfiltered (vendor's Bookings passes `onClear`; its dashboard does
   * not). It filters on the BOOKING DATE column — the only date Q12 shows. Ranges are
   * inclusive. PRESETS are the user's choice (2026-11-04, README F8), not vendor's five: every
   * one is WHOLE calendar months, as vendor's own "This month" is, so a preset lines up with a
   * payout month. "Last 3 months" = this month and the two before it. Today is fixed at
   * 4 Nov 2026 like every other fixture.
   *
   * WORKS in the preview: `mount` wires the presets, fields and chips to re-render the list.
   */
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const iso = (d) => {
    const [dd, m, y] = d.split(" ");
    return `${y}-${String(MON.indexOf(m) + 1).padStart(2, "0")}-${dd.padStart(2, "0")}`;
  };
  const human = (s) => {
    const [y, m, d] = s.split("-");
    return `${Number(d)} ${MON[Number(m) - 1]} ${y}`;
  };
  const TODAY = "2026-11-04";
  const PRESETS = [
    { key: "month",  label: "This month",    from: "2026-11-01", to: "2026-11-30" },
    { key: "last",   label: "Last month",    from: "2026-10-01", to: "2026-10-31" },
    { key: "last3",  label: "Last 3 months", from: "2026-09-01", to: "2026-11-30" },
  ];
  /* Cancelled lines appear only under "All": nothing is owed on them, so no other bucket fits. */
  const STATUS = [
    { key: "all",      label: "All",         kinds: null },
    { key: "upcoming", label: "Upcoming",    kinds: ["upcoming"] },
    { key: "earned",   label: "Earned",      kinds: ["earned"] },
    { key: "available", label: "Available",  kinds: ["available"] },
    { key: "held",     label: "Held",        kinds: ["held"] },
    { key: "paid",     label: "Withdrawn",   kinds: ["paid", "writeoff"] },
    { key: "adjust",   label: "Adjustments", kinds: ["adjust"] },
  ];

  const presetFor = (s) => (PRESETS.find((p) => p.from === s.from && p.to === s.to) || {}).key || null;
  const ranged = (s) => Boolean(s.from || s.to);
  const rangeText = (s) => {
    if (s.from && s.to) return s.from === s.to ? human(s.from) : `${human(s.from)} – ${human(s.to)}`;
    if (s.from) return `from ${human(s.from)}`;
    if (s.to) return `until ${human(s.to)}`;
    return "all dates";
  };
  /* The same range as a phrase inside a sentence: "on 4 Nov", "between 29 Oct and 4 Nov". */
  const rangePhrase = (s) => {
    if (s.from && s.to) return s.from === s.to ? `on ${human(s.from)}` : `between ${human(s.from)} and ${human(s.to)}`;
    return rangeText(s);
  };
  const matches = (s) => LINES.filter((l) => {
    const d = iso(l.d);
    const kinds = STATUS.find((st) => st.key === s.status).kinds;
    return (!s.from || d >= s.from) && (!s.to || d <= s.to) && (!kinds || kinds.includes(l.kind));
  });

  const dateField = (edge, label, s) => `
    <div class="af-dr-field">
      <label for="af-${edge}" class="af-dr-lbl">${label}</label>
      <input id="af-${edge}" type="date" class="rs-input af-date" data-edge="${edge}" value="${s[edge] || ""}"${
        edge === "from" && s.to ? ` max="${s.to}"` : ""}${edge === "to" && s.from ? ` min="${s.from}"` : ""}>
    </div>`;

  const filterCard = (s) => {
    const active = ranged(s) ? presetFor(s) : null;
    return card(`
      <div class="af-dr-head">
        ${PV.icon("cal", 14)}
        <p class="af-dr-title">Booking date</p>
        <p class="af-dr-showing" aria-live="polite">Showing ${esc(rangeText(s))}</p>
      </div>
      <div class="af-dr-presets" role="group" aria-label="Booking date presets">
        ${each(PRESETS, (p) => `<button type="button" class="af-pill${p.key === active ? " is-on" : ""}" data-preset="${p.key}" aria-pressed="${p.key === active}">${esc(p.label)}</button>`)}
        ${ranged(s) ? `<button type="button" class="af-pill" data-clear="1">${PV.icon("x", 11)}<span>All dates</span></button>` : ""}
      </div>
      <div class="af-dr-fields">${dateField("from", "From", s)}${dateField("to", "To", s)}</div>`, "rs-card af-dr");
  };

  const emptyState = (s) => `
    <div class="af-empty">
      <p class="af-card-title">No commission lines match</p>
      <p class="af-fine">Nothing ${s.status === "all" ? "" : `with the status “${esc(STATUS.find((st) => st.key === s.status).label)}” `}has a booking date ${esc(rangePhrase(s))}.</p>
      <button type="button" class="pvb" data-reset="1">Clear filters</button>
    </div>`;

  const linesBody = (s) => {
    const rows = matches(s);
    return `
      ${filterCard(s)}
      <div class="af-chips" role="group" aria-label="Filter by status">
        ${each(STATUS, (st) => `<button type="button" class="af-chip${st.key === s.status ? " is-on" : ""}" data-status="${st.key}" aria-pressed="${st.key === s.status}">${esc(st.label)}</button>`)}
      </div>
      <p class="af-count" aria-live="polite">${rows.length} of ${LINES.length} lines</p>
      ${card(rows.length ? linesTable(rows, { full: true }) : emptyState(s), "rs-card af-tablecard")}`;
  };

  /* The listener sits on #af-lines, which the next screen change removes with it — nothing is
     left on #root (the controller's mount rule). Re-rendering drops focus: preview-only. */
  const mountLines = (initial) => (root) => {
    const box = root.querySelector("#af-lines");
    let s = { ...initial };
    const draw = () => { box.innerHTML = linesBody(s); };
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.preset) {
        const p = PRESETS.find((x) => x.key === b.dataset.preset);
        s = { ...s, from: p.from, to: p.to };
      } else if (b.dataset.clear) s = { ...s, from: "", to: "" };
      else if (b.dataset.reset) s = { from: "", to: "", status: "all" };
      else if (b.dataset.status) s = { ...s, status: b.dataset.status };
      else return;
      draw();
    });
    box.addEventListener("change", (e) => {
      const edge = e.target.dataset && e.target.dataset.edge;
      if (!edge) return;
      const next = { ...s, [edge]: e.target.value };
      /* An inverted range is rejected, as vendor's rangeWithFrom/rangeWithTo do. */
      if (!(next.from && next.to && next.from > next.to)) s = next;
      draw();
    });
  };

  const lines = (initial) => () => shell("lines", "Commission", `Your own commission lines. Each share is ${ME.rate}% of Ezzy's fee after tax, at the rates in force when the booking completed.`, `
    <div id="af-lines">${linesBody(initial)}</div>
    ${card(`
      <p class="af-card-title">What the statuses mean</p>
      <dl class="af-legend">
        ${each(Object.keys(KIND), (k) => `<div><dt>${badge(k)}</dt><dd>${esc(KIND[k].explain)}</dd></div>`)}
      </dl>`, "rs-card af-legendcard")}`);

  const ALL_DATES = { from: "", to: "", status: "all" };
  const LAST_MONTH = { from: "2026-10-01", to: "2026-10-31", status: "all" };
  /* Nothing with a November booking date has been WITHDRAWN yet. */
  const NONE = { from: "2026-11-01", to: "2026-11-30", status: "paid" };

  /*
   * ── Withdraw (discovery Q42–Q50; replaces monthly payouts) ────────────────────────────
   * Nothing is sent until the affiliate asks. Commission is withdrawable 7 days after the
   * booking completed (Q42). A withdrawal takes the WHOLE available balance and covers named
   * lines (Q43). Requested → Processing → Completed; cancel while Requested; one open request
   * (Q44). The minimum is a Command setting (Q45). Payout details are entered by Ezzy staff
   * and shown MASKED; without them Withdraw is disabled (Q46, Q17, Q26, Q32). Ezzy pays the
   * transfer fee (Q47); no tax is withheld (Q27); processed within 5 business days (Q50).
   *
   * Fixture story: W-1007 (three October lines, ₱5.76) was requested 27 Oct and completed
   * 29 Oct. On 4 Nov ₱1.16 is available, under the sample ₱5.00 minimum. The `ready`,
   * `requested`, `processing` and `nodetails` states are ONE WEEK LATER (11 Nov), when the
   * three earned lines have become available and the balance is ₱5.85.
   */
  const DEST = { label: "BDO Unibank", masked: "••••••••7890" };
  const W1007 = LINES.filter((l) => l.w.startsWith("W-1007"));
  const W1007_TOTAL = sum(["paid", "writeoff"], W1007);
  const W1012 = LINES.filter((l) => ["earned", "available", "adjust"].includes(l.kind));

  const miniLines = (rows, extra) => `
    <table class="af-table is-full af-stable">
      <thead><tr><th scope="col">Ref</th><th scope="col">Booking date</th><th scope="col">Vendor</th>${extra ? `<th scope="col">${esc(extra.head)}</th>` : ""}<th scope="col" class="num">Your share</th></tr></thead>
      <tbody>
        ${each(rows, (l) => `
          <tr>
            <td data-label="Ref" class="af-ref">${esc(l.ref)}</td>
            <td data-label="Booking date">${esc(l.d)}</td>
            <td data-label="Vendor"><b>${esc(l.v)}</b></td>
            ${extra ? `<td data-label="${esc(extra.head)}">${esc(extra.cell(l))}</td>` : ""}
            <td data-label="Your share" class="num af-share">${signed(l.share)}</td>
          </tr>`)}
      </tbody>
    </table>`;

  const destCard = (has) => card(has ? `
    <p class="af-card-title">Where you're paid</p>
    <p class="af-dest"><b>${esc(DEST.label)}</b><span>${esc(DEST.masked)}</span></p>
    <p class="af-fine">To change this, contact Ezzy support. We confirm it is you before changing anything. The full account number is never shown here.</p>` : `
    <p class="af-card-title">Where you're paid</p>
    <p class="af-dest"><b>Not set yet</b></p>
    <p class="af-fine">Contact Ezzy support to set where you are paid. We confirm it is you by phone and enter the details for you.</p>`, "rs-card");

  const howCard = () => card(`
    <p class="af-card-title">How withdrawals work</p>
    <ul class="af-how">
      <li>Commission becomes available 7 days after the booking is completed.</li>
      <li>Once you reach the minimum, you withdraw your whole available balance.</li>
      <li>Ezzy sends it within 5 business days and pays the transfer fee.</li>
      <li>One withdrawal at a time. New commission keeps building for the next one.</li>
    </ul>`, "rs-card");

  const pendingCard = () => card(`
    <div class="af-card-head">
      <div><p class="af-card-title">Earned, not yet available</p>
        <p class="af-card-sub">Each line becomes available 7 days after its booking completed</p></div>
      <p class="af-big">${peso(PENDING)}</p>
    </div>
    ${miniLines(LINES.filter((l) => l.kind === "earned"), { head: "Available", cell: (l) => l.w.replace("Available ", "") })}`, "rs-card");

  const STEPS = ["Requested", "Processing", "Completed"];
  const requestCard = (state) => {
    const at = state === "processing" ? 1 : 0;
    return card(`
      <div class="af-card-head">
        <div><p class="af-card-title">Withdrawal W-1012</p>
          <p class="af-card-sub">Requested 11 Nov 2026 · to ${esc(DEST.label)} ${esc(DEST.masked)}</p></div>
        <p class="af-big">${peso(READY)}</p>
      </div>
      <ol class="af-steps" aria-label="Progress of this withdrawal">
        ${each(STEPS, (label, i) => `<li data-s="${i < at ? "done" : i === at ? "now" : "todo"}"${i === at ? ' aria-current="step"' : ""}>${esc(label)}</li>`)}
      </ol>
      <p class="af-fine">${state === "processing"
        ? "Ezzy is sending this now. It can no longer be cancelled."
        : "Ezzy has been notified and will send this within 5 business days. You can cancel until Ezzy starts processing it."}
        Commission you earn in the meantime builds up for your next withdrawal.</p>
      ${miniLines(W1012)}
      ${state === "requested" ? `<div class="af-code-actions af-actions-top">${button("Cancel request", { goto: "withdraw-ready" })}</div>` : ""}`, "rs-card");
  };

  const receiptCard = () => card(`
    <div class="af-card-head">
      <div><p class="af-card-title">Withdrawal W-1007 · completed</p>
        <p class="af-card-sub">Requested 27 Oct 2026 · sent 29 Oct 2026 to ${esc(DEST.label)} ${esc(DEST.masked)} · transfer ref IP-88431207</p></div>
      <p class="af-big">${peso(W1007_TOTAL)}</p>
    </div>
    ${miniLines(W1007)}
    <p class="af-fine">A receipt was emailed to ${esc(ME.email)}. Line C-10396 was refunded after this withdrawal; it is written off and not taken back.</p>`, "rs-card");

  const withdraw = (state) => () => {
    const later = state !== "below";
    const open = state === "requested" || state === "processing";
    const cta = {
      below: `<div class="af-code-actions">${button("Withdraw", { primary: true, disabled: true, reason: `Reach the ${peso(MIN)} minimum first` })}<span class="af-reason">Reach the ${peso(MIN)} minimum first</span></div>`,
      ready: `
        <p class="af-fine">This withdraws your whole available balance: ${W1012.length} lines, sent to ${esc(DEST.label)} ${esc(DEST.masked)}.</p>
        <div class="af-code-actions">${button(`Withdraw ${peso(READY)}`, { primary: true, goto: "withdraw-requested" })}</div>`,
      nodetails: `<div class="af-code-actions">${button("Withdraw", { primary: true, disabled: true, reason: "Ezzy needs to know where to pay you first" })}<span class="af-reason">Ezzy needs to know where to pay you first</span></div>`,
    }[state];
    return shell("withdraw", "Withdraw", "Take out the commission you have earned. Nothing is sent until you ask.", `
      ${later ? '<p class="af-pvnote" role="note">Preview state: one week later, 11 Nov 2026, once the three earned lines have become available.</p>' : ""}
      ${state === "nodetails" ? `<div class="af-waiting" role="status">${PV.icon("alert", 16)}<p><b>Tell Ezzy where to pay you.</b> You have reached the minimum, but you cannot withdraw until your payout details are on file. Your balance is safe and keeps building.</p></div>` : ""}
      <div class="af-grid af-grid-top">
        <div class="af-col">
          ${open ? requestCard(state) : balanceCard({ amount: later ? READY : AVAILABLE, pending: later ? 0 : PENDING, cta })}
          ${state === "below" ? pendingCard() : ""}
          ${receiptCard()}
        </div>
        <div class="af-col af-col-side">${destCard(state !== "nodetails")}${howCard()}</div>
      </div>`);
  };

  /*
   * ── Settings: customise the referral code ─────────────────────────────────────────────
   * Decisions (discovery log Q16a–d, 2026-11-10):
   *   a  an old code KEEPS crediting its affiliate and stays reserved to them forever
   *   b  an affiliate may change their own code once per 30 days (Command any time)
   *   c  a change applies at once; the database refuses reserved/blocked words; every change
   *      goes to an append-only history Command can read
   *   d  Command's existing change follows the same rule
   * Codes keep today's rule: `^[A-Z0-9]{4,32}$`, stored upper-cased
   * (20260917000001; `vendor/lib/referralCode.ts` normalises "rina-dp" → "RINADP").
   * The share link is Command's `buildReferralUrl`: the vendor origin + `/?ref=CODE`.
   *
   * Fixture story: Ezzy imported RINA01 before launch (1 Jul); Rina changed it to RINAREFERS
   * on 20 Sep (45 days ago, so she may change again); `settings-saved` is the moment after she
   * saves RINADP today, 4 Nov — her next change opens 4 Dec.
   */
  const VENDOR_ORIGIN = "https://vendor.ezzy.ph";
  /* Other affiliates' codes, current OR retired — a retired code is reserved, so it reads as taken. */
  const TAKEN = ["NINA2026", "JUAN2026", "PADELPRO", "MANILAMOVES"];
  /* Matched anywhere in the code. The real list (and an offensive-terms list) is plan work. */
  const BLOCKED = ["EZZY", "BOOKDECK", "ADMIN", "SUPPORT", "OFFICIAL", "STAFF"];

  const HISTORY_BEFORE = [
    { code: "RINAREFERS", since: "20 Sep 2026", by: "Changed by you", current: true },
    { code: "RINA01",     since: "1 Jul 2026",  by: "Set by Ezzy (imported)" },
  ];
  const HISTORY_AFTER = [
    { code: "RINADP",     since: "4 Nov 2026",  by: "Changed by you", current: true },
    { code: "RINAREFERS", since: "20 Sep 2026", by: "Changed by you" },
    { code: "RINA01",     since: "1 Jul 2026",  by: "Set by Ezzy (imported)" },
  ];

  const normalise = (raw) => String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");

  /* One verdict per rule: true = passes, false = fails, null = not checked yet (empty field). */
  const check = (raw, current, own) => {
    const n = normalise(raw);
    if (!n) return { n, format: null, word: null, free: null, msg: "", ok: false };
    const format = n.length >= 4 && n.length <= 32;
    const hit = BLOCKED.find((w) => n.includes(w));
    const free = !TAKEN.includes(n);
    let msg = "";
    if (n === current) msg = "That is already your code.";
    else if (!format) msg = n.length < 4 ? "Use at least 4 letters or numbers." : "Use 32 letters or numbers at most.";
    else if (hit) msg = `Codes can't contain “${hit}”. It is reserved for Ezzy's own links.`;
    else if (!free) msg = "Another affiliate already uses this code. Try adding a number or your initials.";
    /* One of YOUR old codes is free to you: switching back makes it current again. */
    const yours = own.includes(n) && n !== current;
    return { n, format, word: !hit, free, yours, msg, ok: !msg };
  };

  const RULES = [
    { key: "format", label: "4 to 32 letters or numbers" },
    { key: "word",   label: "No reserved words, such as EZZY or ADMIN" },
    { key: "free",   label: "Not used by another affiliate" },
  ];
  const mark = (v) => (v === null ? "" : v ? "1" : "0");

  const codeCard = (code) => card(`
    <p class="af-kpi-k">Your referral code</p>
    <p class="af-code-v">${esc(code)}</p>
    <p class="af-link">${glyph("link", 13)}<span>${esc(`${VENDOR_ORIGIN}/?ref=${code}`)}</span></p>
    <div class="af-code-actions">
      <button type="button" class="pvb af-copy">${glyph("copy", 14)}<span>Copy code</span></button>
      <button type="button" class="pvb af-copy">${glyph("link", 14)}<span>Copy link</span></button>
    </div>
    <p class="af-fine">Vendors who sign up through this link, or type this code when they register, are credited to you.</p>`, "rs-card");

  const historyCard = (rows) => card(`
    <p class="af-card-title">Your codes</p>
    <p class="af-card-sub">Every code you have had still credits you. Nobody else can ever use them.</p>
    <ul class="af-hist">
      ${each(rows, (h) => `
        <li>
          <span class="af-hist-code">${esc(h.code)}</span>
          <span class="af-hist-meta">${esc(h.by)} · ${esc(h.since)}</span>
          <span class="af-badge" data-code="${h.current ? "current" : "old"}">${h.current ? "Current" : "Still works"}</span>
        </li>`)}
    </ul>`, "rs-card");

  const changeForm = (raw, current, own) => {
    const c = check(raw, current, own);
    const olds = own.filter((x) => x !== current);
    return card(`
      <p class="af-card-title">Change your code</p>
      <p class="af-card-sub">Pick something easy to say and type. You can change it once every 30 days.</p>
      <div class="af-codeform" id="af-codeform">
        <label for="af-code-new" class="af-dr-lbl">New code</label>
        <input id="af-code-new" class="rs-input af-codein${c.msg ? " is-invalid" : ""}" value="${esc(raw)}" maxlength="40"
          autocomplete="off" autocapitalize="characters" spellcheck="false"
          aria-describedby="af-code-msg af-code-rules"${c.msg ? ' aria-invalid="true"' : ""}>
        <p class="af-norm" aria-live="polite">Saved as <b data-norm>${esc(c.n || "—")}</b><span class="af-norm-note"${c.yours ? "" : " hidden"}> · one of your earlier codes, it becomes current again</span></p>
        <p class="af-codemsg" id="af-code-msg" role="alert">${esc(c.msg)}</p>
        <ul class="af-rules" id="af-code-rules">
          ${each(RULES, (r) => `<li data-rule="${r.key}" data-ok="${mark(c[r.key])}">${esc(r.label)}</li>`)}
        </ul>
        <div class="af-keep" role="note">
          <b>Links you've already shared keep working.</b> ${esc([current, ...olds].join(" and "))} will still credit you
          after the change, and no one else can take ${olds.length ? "them" : "it"}.
        </div>
        <div class="af-code-actions">
          <button type="button" class="pvb btn-primary" data-goto="settings-saved" data-save="1"${c.ok ? "" : " disabled"}${c.ok ? "" : ' title="Fix the code above first"'}>Save new code</button>
        </div>
      </div>`, "rs-card");
  };

  const lockedCard = () => card(`
    <p class="af-card-title">Change your code</p>
    <div class="af-locked">
      ${PV.icon("cal", 16)}
      <p>You changed your code today. You can change it again from <b>4 Dec 2026</b>.
        Need it sooner? Ezzy support can change it for you.</p>
    </div>`, "rs-card");

  const settings = ({ raw, saved }) => () => {
    const current = saved ? "RINADP" : ME.code;
    const history = saved ? HISTORY_AFTER : HISTORY_BEFORE;
    const own = history.map((h) => h.code);
    return shell("settings", "Settings", "Your referral code and the codes you have used before.", `
      ${saved ? `<div class="af-saved" role="status">${PV.icon("ok", 16)}<p><b>Your code is now RINADP.</b> RINAREFERS and RINA01 still credit you.</p></div>` : ""}
      <div class="af-grid af-grid-top">
        <div class="af-col">
          ${codeCard(current)}
          ${saved ? lockedCard() : changeForm(raw, current, own)}
        </div>
        <div class="af-col af-col-side">${historyCard(history)}</div>
      </div>`);
  };

  /* Live validation. Updates the existing nodes in place — never re-renders — so the Save
     button keeps the `data-goto` listener the controller attached to it. */
  const mountSettings = (root) => {
    const form = root.querySelector("#af-codeform");
    if (!form) return;
    const input = form.querySelector("#af-code-new");
    const own = HISTORY_BEFORE.map((h) => h.code);
    input.addEventListener("input", () => {
      const c = check(input.value, ME.code, own);
      form.querySelector("[data-norm]").textContent = c.n || "—";
      form.querySelector(".af-norm-note").hidden = !c.yours;
      form.querySelector("#af-code-msg").textContent = c.msg;
      input.classList.toggle("is-invalid", Boolean(c.msg));
      if (c.msg) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
      RULES.forEach((r) => { form.querySelector(`[data-rule="${r.key}"]`).dataset.ok = mark(c[r.key]); });
      const save = form.querySelector("[data-save]");
      save.disabled = !c.ok;
      if (c.ok) save.removeAttribute("title"); else save.title = "Fix the code above first";
    });
  };

  window.PREVIEW_SCREENS = [
    { id: "overview", label: "Dashboard overview", render: overview },
    { id: "vendors",  label: "Vendors list",       render: vendors },
    { id: "lines",       label: "Commission lines · all dates", render: lines(ALL_DATES), mount: mountLines(ALL_DATES) },
    { id: "lines-lastmonth", label: "Commission · last month", render: lines(LAST_MONTH), mount: mountLines(LAST_MONTH) },
    { id: "lines-empty", label: "Commission · no matches",      render: lines(NONE),      mount: mountLines(NONE) },
    { id: "withdraw",            label: "Withdraw · below the minimum",   render: withdraw("below") },
    { id: "withdraw-ready",      label: "Withdraw · ready",               render: withdraw("ready") },
    { id: "withdraw-requested",  label: "Withdraw · requested",           render: withdraw("requested") },
    { id: "withdraw-processing", label: "Withdraw · processing",          render: withdraw("processing") },
    { id: "withdraw-nodetails",  label: "Withdraw · no payout details",   render: withdraw("nodetails") },
    { id: "settings",       label: "Settings · change code",      render: settings({ raw: "rina-dp" }),   mount: mountSettings },
    { id: "settings-error", label: "Settings · reserved word",    render: settings({ raw: "ezzy-rina" }), mount: mountSettings },
    { id: "settings-saved", label: "Settings · saved, next change in 30 days", render: settings({ saved: true }) },
  ];
})();
