/*
 * affiliate-command — the COMMAND side of the affiliate feature. THIS FILE IS THE WORK.
 *
 * Decisions drawn (`.plans/2026-11-02-affiliate-dashboard-discovery.md`):
 *   Q37      a new Affiliates section in Command; creating an affiliate stays on Users
 *   Q44      withdrawals queue: Requested → Processing → Completed; Reject with a reason;
 *            "Start processing" locks the request and re-checks the amount
 *   Q45      Settings: the tax rate and the minimum withdrawal, both starting UNSET
 *   Q7/Q35   default rate 1% of Ezzy's fee after tax, overridable per affiliate
 *   Q17/Q26/Q32  staff enter payout details after confirming identity; stored encrypted;
 *            full details shown only on request, and every reveal is recorded
 *   Q18/Q19  change a vendor's referrer (reason, forward-only); credit a vendor that has no
 *            referrer within 30 days of its sign-up
 *   Q48      staff affiliates are paid through payroll, recorded as a completed withdrawal
 *   Q16d     Command's code change keeps old codes working
 *   Q49      a request notifies every Command admin (in-app + email)
 *
 * The companion affiliate-side preview is `../affiliate-dashboard/`; Rina's figures here are
 * the same ones (W-1012 for ₱5.85, W-1007 for ₱5.76, BDO ••7890).
 *
 * ⚠️ command has no `_shared/command.js` chrome, so the shell is written here, in the shape of
 * `command/components/layout/Sidebar/` (Reporting / Management / System groups).
 *
 * Fixtures are INVENTED. "Today" is Wed 11 Nov 2026. The 12% tax and the ₱5.00 minimum are
 * SAMPLES: both are settings that start unset.
 */
"use strict";

(function () {
  const { esc, each, card, button, icon } = window.PV;
  const peso = (n) => `₱${Math.abs(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const signed = (n) => (n < 0 ? `−${peso(n)}` : peso(n));

  /* ── fixtures ──────────────────────────────────────────────────────────────────────────── */
  const AFFILIATES = [
    { id: "rina",  n: "Rina Dela Paz", e: "rina@example.com",  type: "Partner", code: "RINAREFERS",  rate: "1%", over: false, vendors: 6, avail: 0,     flag: "requested", fl: "Withdrawal requested", open: "affiliate" },
    { id: "bea",   n: "Bea Tan",       e: "bea@example.com",   type: "Partner", code: "MANILAMOVES", rate: "1%", over: false, vendors: 4, avail: 0,     flag: "processing", fl: "Withdrawal processing" },
    { id: "juan",  n: "Juan Cruz",     e: "juan@example.com",  type: "Partner", code: "JUAN2026",    rate: "2%", over: true,  vendors: 3, avail: 12.4,  flag: "nodetails", fl: "No payout details" },
    { id: "nina",  n: "Nina Santos",   e: "nina@example.com",  type: "Staff",   code: "NINA2026",    rate: "1%", over: false, vendors: 2, avail: 3.1,   flag: "payroll", fl: "Paid through payroll", open: "affiliate-staff" },
    { id: "marco", n: "Marco Lim",     e: "marco@example.com", type: "Vendor",  code: "PADELPRO",    rate: "1%", over: false, vendors: 1, avail: 0,     flag: "suspended", fl: "Suspended" },
  ];

  const WITHDRAWALS = [
    { ref: "W-1012", who: "Rina Dela Paz", amt: 5.85, st: "requested",  sl: "Requested",  when: "11 Nov 2026, 9:14 am", dest: "BDO Unibank ••••••••7890", open: "withdrawal" },
    { ref: "W-1011", who: "Bea Tan",       amt: 8.2,  st: "processing", sl: "Processing", when: "9 Nov 2026 · started 10 Nov by Ops Admin", dest: "GCash •••••••4421", open: "withdrawal-processing" },
    { ref: "W-1007", who: "Rina Dela Paz", amt: 5.76, st: "completed",  sl: "Completed",  when: "27 Oct 2026 · sent 29 Oct", dest: "BDO Unibank ••••••••7890" },
    { ref: "W-1006", who: "Bea Tan",       amt: 5.1,  st: "rejected",   sl: "Rejected",   when: "21 Oct 2026 · rejected 22 Oct", dest: "GCash •••••••4421", note: "Account name did not match. Details corrected with the affiliate by phone; she can request again." },
    { ref: "W-1004", who: "Bea Tan",       amt: 6.02, st: "completed",  sl: "Completed",  when: "18 Oct 2026 · sent 20 Oct", dest: "GCash •••••••4421" },
  ];

  /* W-1012's lines — the same five as the affiliate-side preview. */
  const W1012 = [
    { ref: "C-10471", d: "3 Nov 2026",  v: "Bayside Yoga Loft", share: 0.82 },
    { ref: "C-10463", d: "1 Nov 2026",  v: "Kalye Padel Club",  share: 1.55 },
    { ref: "C-10460", d: "31 Oct 2026", v: "Kalye Padel Club",  share: -0.39, note: "Fee correction" },
    { ref: "C-10452", d: "29 Oct 2026", v: "Northpoint Futsal", share: 2.32 },
    { ref: "C-10441", d: "26 Oct 2026", v: "Kalye Padel Club",  share: 1.55 },
  ];

  const RINA_VENDORS = [
    { n: "Kalye Padel Club",    st: "active",    sl: "Active",             up: "12 Aug 2026", code: "RINA01" },
    { n: "Bayside Yoga Loft",   st: "active",    sl: "Active",             up: "3 Sep 2026",  code: "RINA01" },
    { n: "Northpoint Futsal",   st: "active",    sl: "Active",             up: "21 Sep 2026", code: "RINAREFERS" },
    { n: "Studio Sampaguita",   st: "active",    sl: "Active",             up: "8 Oct 2026",  code: "RINAREFERS" },
    { n: "Lakeview Pickleball", st: "pending",   sl: "Pending activation", up: "28 Oct 2026", code: "RINAREFERS" },
    { n: "Harbour Swim School", st: "suspended", sl: "Suspended",          up: "2 Jul 2026",  code: "RINA01" },
  ];

  /* ── shell ─────────────────────────────────────────────────────────────────────────────── */
  const NAV = [
    { group: "Reporting", items: ["Overview", "Transactions", "Vendors", "Users"] },
    { group: "Management", items: ["Flags", "Payouts", "Closures", { id: "affiliates", label: "Affiliates", count: 2 }] },
    { group: "System", items: [{ id: "settings", label: "Settings" }] },
  ];
  /* Only the two sections this preview draws are buttons; the rest are inert labels, so the
     review is not sent to screens that do not exist here. */
  const navItem = (it, active, cls) => {
    if (typeof it === "string") return `<span class="${cls} is-inert">${esc(it)}</span>`;
    const on = it.id === active;
    return `<button type="button" class="${cls}${on ? " is-on" : ""}" data-goto="${it.id}"${on ? ' aria-current="page"' : ""}><span>${esc(it.label)}</span>${it.count ? `<span class="cm-count" aria-label="${it.count} open withdrawals">${it.count}</span>` : ""}</button>`;
  };

  const shell = (active, title, sub, body, overlay = "") => `
    <div class="rs-page af">
      <aside class="rs-sidebar af-side">
        <div class="af-brand">
          <span class="af-logo" aria-hidden="true">E</span>
          <span class="cm-brand"><b>Ezzy Command</b><span>Back Office</span></span>
        </div>
        <nav class="af-nav" aria-label="Main">
          ${each(NAV, (g) => `<p class="af-navlabel">${esc(g.group)}</p>${each(g.items, (it) => navItem(it, active, "af-navitem"))}`)}
        </nav>
        <div class="af-user">
          <span class="af-avatar" aria-hidden="true">C</span>
          <span class="af-user-text"><b>Command Admin</b><span>ops@example.com</span></span>
        </div>
      </aside>
      <div class="af-main">
        <header class="rs-topbar af-top">
          <span class="af-top-brand"><span class="af-logo" aria-hidden="true">E</span><b>Ezzy Command</b></span>
          <span class="rs-pill af-rate cm-bell">${icon("alert", 13)}<span><b>Withdrawal requested</b> · Rina Dela Paz · ${peso(5.85)} · 9:14 am</span></span>
        </header>
        <nav class="rs-tabbar af-tabs" aria-label="Main">
          ${each(NAV, (g) => each(g.items, (it) => navItem(it, active, "af-tab")))}
        </nav>
        <main class="af-body">
          <div class="af-head">
            <h1 class="af-title">${esc(title)}</h1>
            ${sub ? `<p class="af-sub">${esc(sub)}</p>` : ""}
          </div>
          ${body}
        </main>
      </div>
      ${overlay}
    </div>`;

  /* ── pieces ────────────────────────────────────────────────────────────────────────────── */
  const subtabs = (on) => `
    <div class="af-chips" role="group" aria-label="Affiliates section">
      <button type="button" class="af-chip${on === "affiliates" ? " is-on" : ""}" data-goto="affiliates" aria-pressed="${on === "affiliates"}">Affiliates</button>
      <button type="button" class="af-chip${on === "withdrawals" ? " is-on" : ""}" data-goto="withdrawals" aria-pressed="${on === "withdrawals"}">Withdrawals<span class="cm-count">2</span></button>
    </div>`;

  const wbadge = (w) => `<span class="af-badge" data-w="${w.st}">${esc(w.sl)}</span>`;
  const flag = (a) => `<span class="af-badge" data-flag="${a.flag}">${esc(a.fl)}</span>`;
  const vbadge = (v) => `<span class="af-badge" data-vst="${v.st}">${esc(v.sl)}</span>`;
  const kv = (rows) => `<dl class="cm-kv">${each(rows, ([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`)}</dl>`;
  const pvnote = (text) => `<p class="af-pvnote" role="note">${esc(text)}</p>`;

  const stat = (k, v, d, accent) => `
    <div class="pvc rs-card af-kpi" data-accent="${accent}">
      <p class="af-kpi-k">${esc(k)}</p><p class="af-kpi-v">${esc(v)}</p><p class="af-kpi-d">${esc(d)}</p>
    </div>`;

  const lineTable = (rows) => `
    <table class="af-table is-full af-stable">
      <thead><tr><th scope="col">Ref</th><th scope="col">Booking date</th><th scope="col">Vendor</th><th scope="col" class="num">Share</th></tr></thead>
      <tbody>${each(rows, (l) => `
        <tr>
          <td data-label="Ref" class="af-ref">${esc(l.ref)}</td>
          <td data-label="Booking date">${esc(l.d)}</td>
          <td data-label="Vendor"><b>${esc(l.v)}</b>${l.note ? `<span class="af-note">${esc(l.note)}</span>` : ""}</td>
          <td data-label="Share" class="num af-share">${signed(l.share)}</td>
        </tr>`)}</tbody>
    </table>`;

  /* Form bits. A checkbox is drawn as a 44px row whose <input> covers the whole row, so the
     tap target is the row, not a 13px box. */
  const fld = (id, label, control, hint = "") => `
    <div class="cm-field">
      <label for="${id}" class="af-dr-lbl">${esc(label)}</label>
      ${control}
      ${hint ? `<p class="cm-hint">${esc(hint)}</p>` : ""}
    </div>`;
  const input = (id, value, attrs = "") => `<input id="${id}" class="rs-input cm-input" value="${esc(value)}" ${attrs}>`;
  const select = (id, options, chosen) => `<select id="${id}" class="rs-input cm-input">${each(options, (o) => `<option${o === chosen ? " selected" : ""}>${esc(o)}</option>`)}</select>`;
  const area = (id, value, placeholder) => `<textarea id="${id}" class="rs-input cm-input cm-area" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`;
  const check = (id, label, on) => `
    <label class="cm-check" for="${id}"><input id="${id}" type="checkbox"${on ? " checked" : ""}><span class="cm-box" aria-hidden="true">${on ? "✓" : ""}</span><span>${esc(label)}</span></label>`;

  const modal = (title, back, body, actions) => `
    <div class="cm-overlay">
      <div class="rs-panel cm-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="cm-modal-head">
          <h2>${esc(title)}</h2>
          <button type="button" class="cm-x" data-goto="${back}" aria-label="Close">${icon("x", 16)}</button>
        </div>
        ${body}
        <div class="cm-modal-actions">${actions}</div>
      </div>
    </div>`;

  /* ── Affiliates list ───────────────────────────────────────────────────────────────────── */
  const affiliates = () => shell("affiliates", "Affiliates", "Everyone with a referral code: what they are owed, and what needs your attention.", `
    ${subtabs("affiliates")}
    <div class="af-kpis">
      ${stat("Affiliates", "5", "4 active · 1 suspended", "upcoming")}
      ${stat("Open withdrawals", "2", `${peso(14.05)} to send`, "held")}
      ${stat("Available, not requested", peso(15.5), "Across 2 affiliates", "payout")}
      ${stat("No payout details", "1", "Cannot withdraw until set", "vendors")}
    </div>
    ${card(`
      <div class="cm-toolbar">
        <div class="rs-input cm-search">${icon("search", 15)}<span>Search name, email or code</span></div>
        <p class="af-fine cm-toolbar-note">New affiliates are created on the Users page.</p>
      </div>
      <table class="af-table is-full">
        <thead><tr>
          <th scope="col">Affiliate</th><th scope="col">Type</th><th scope="col">Code</th><th scope="col" class="num">Rate</th>
          <th scope="col" class="num">Vendors</th><th scope="col" class="num">Available</th><th scope="col">Needs attention</th><th scope="col"><span class="cm-sr">Open</span></th>
        </tr></thead>
        <tbody>
          ${each(AFFILIATES, (a) => `
            <tr>
              <td data-label="Affiliate"><b>${esc(a.n)}</b><span class="af-note">${esc(a.e)}</span></td>
              <td data-label="Type">${esc(a.type)}</td>
              <td data-label="Code" class="af-ref">${esc(a.code)}</td>
              <td data-label="Rate" class="num">${esc(a.rate)}${a.over ? '<span class="af-note">override</span>' : ""}</td>
              <td data-label="Vendors" class="num">${a.vendors}</td>
              <td data-label="Available" class="num af-share">${peso(a.avail)}</td>
              <td data-label="Needs attention">${flag(a)}</td>
              <td data-label="" class="cm-rowact">${a.open ? button("Open", { goto: a.open }) : ""}</td>
            </tr>`)}
        </tbody>
      </table>`, "rs-card af-tablecard")}`);

  /* ── Affiliate detail ──────────────────────────────────────────────────────────────────── */
  const rinaBody = () => `
    <div class="cm-back">${button("← All affiliates", { goto: "affiliates" })}</div>
    <div class="af-grid af-grid-top">
      <div class="af-col">
        ${card(`
          <div class="af-card-head">
            <div><p class="af-card-title">Balance</p><p class="af-card-sub">Rate 1% of Ezzy's fee after tax (default)</p></div>
            ${button("Set rate override", {})}
          </div>
          ${kv([
            ["In withdrawal W-1012 (requested)", `<b>${peso(5.85)}</b>`],
            ["Available to withdraw", peso(0)],
            ["Earned, not yet available", peso(0)],
            ["Held (flagged booking)", peso(3.39)],
            ["Withdrawn to date", peso(5.76)],
          ])}
          <div class="af-code-actions af-actions-top">${button("Open W-1012", { goto: "withdrawal", primary: true })}</div>`, "rs-card")}
        ${card(`
          <div class="af-card-head">
            <div><p class="af-card-title">Referred vendors</p><p class="af-card-sub">Commission follows the vendor, not the code it signed up with</p></div>
            ${button("Credit a vendor", { goto: "attach-vendor" })}
          </div>
          <table class="af-table is-full cm-vendors">
            <thead><tr><th scope="col">Vendor</th><th scope="col">Status</th><th scope="col">Signed up</th><th scope="col">Code used</th><th scope="col"><span class="cm-sr">Action</span></th></tr></thead>
            <tbody>
              ${each(RINA_VENDORS, (v, i) => `
                <tr>
                  <td data-label="Vendor"><b>${esc(v.n)}</b></td>
                  <td data-label="Status">${vbadge(v)}</td>
                  <td data-label="Signed up" class="af-date-cell">${esc(v.up)}</td>
                  <td data-label="Code used" class="af-ref">${esc(v.code)}</td>
                  <td data-label="" class="cm-rowact">${i === 0 ? button("Change referrer", { goto: "change-referrer" }) : ""}</td>
                </tr>`)}
            </tbody>
          </table>
          <p class="af-fine">"Change referrer" is drawn on the first row only; every row has it.</p>`, "rs-card")}
      </div>
      <div class="af-col af-col-side">
        ${card(`
          <p class="af-card-title">Rina Dela Paz</p>
          ${kv([["Email", "rina@example.com"], ["Type", "Partner"], ["Account", '<span class="af-badge" data-vst="active">Active</span>'], ["Affiliate since", "1 Jul 2026"]])}`, "rs-card")}
        ${card(`
          <p class="af-card-title">Where they are paid</p>
          <p class="af-dest"><b>BDO Unibank</b><span>••••••••7890</span></p>
          <p class="af-fine">Entered by Ops Admin on 14 Oct 2026, identity confirmed by phone. Stored encrypted.</p>
          <div class="af-code-actions af-actions-top">${button("Show full details", { goto: "withdrawal-processing" })}${button("Replace details", { goto: "payout-details" })}</div>`, "rs-card")}
        ${card(`
          <div class="af-card-head"><p class="af-card-title">Referral codes</p>${button("Change code", {})}</div>
          <ul class="af-hist">
            <li><span class="af-hist-code">RINAREFERS</span><span class="af-hist-meta">Changed by the affiliate · 20 Sep 2026</span><span class="af-badge" data-code="current">Current</span></li>
            <li><span class="af-hist-code">RINA01</span><span class="af-hist-meta">Imported · 1 Jul 2026</span><span class="af-badge" data-code="old">Still works</span></li>
          </ul>
          <p class="af-fine">Changing the code here keeps both of these working too. Old codes are never given to anyone else.</p>`, "rs-card")}
      </div>
    </div>`;

  const affiliate = (overlay = "") => () => shell("affiliates", "Rina Dela Paz", "Affiliate · RINAREFERS", rinaBody(), overlay);

  /* Q17 / Q26 / Q32 — staff enter the details; nothing here is typed by the affiliate. */
  const payoutModal = () => modal("Replace payout details", "affiliate", `
    <p class="af-fine cm-modal-lead">For Rina Dela Paz. These replace BDO Unibank ••••••••7890. The details are encrypted when saved, and the change is recorded with your name.</p>
    ${fld("pm-type", "Paid by", select("pm-type", ["Bank transfer", "GCash", "Maya"], "Bank transfer"))}
    ${fld("pm-bank", "Bank", input("pm-bank", "BDO Unibank"))}
    ${fld("pm-name", "Account name", input("pm-name", "Rina Dela Paz"), "Must match the affiliate's legal name.")}
    ${fld("pm-no", "Account number", input("pm-no", "", 'inputmode="numeric" placeholder="Digits only"'))}
    ${check("pm-ok", "I confirmed this is Rina by phone, on the number we have on file", false)}`,
    `${button("Cancel", { goto: "affiliate" })}${button("Save details", { primary: true, disabled: true, reason: "Enter the account number and confirm identity first" })}<span class="af-reason">Enter the account number and confirm identity first</span>`);

  /* Q18 — forward-only, reason required. */
  const referrerModal = () => modal("Change referrer", "affiliate", `
    <p class="af-fine cm-modal-lead"><b>Kalye Padel Club</b> is credited to <b>Rina Dela Paz</b> since 12 Aug 2026.</p>
    ${fld("cr-to", "Credit this vendor to", select("cr-to", ["Juan Cruz · JUAN2026", "Bea Tan · MANILAMOVES", "Nina Santos · NINA2026", "No one (remove the referral)"], "Juan Cruz · JUAN2026"))}
    ${fld("cr-why", "Reason", area("cr-why", "", "Why is the referral being changed? This is kept in the record."), "Required. Rina and the new affiliate are not notified.")}
    <div class="af-keep" role="note"><b>From now on only.</b> Commission Rina has already earned from this vendor stays hers, including lines not yet withdrawn. Bookings completed after you save are credited to the new affiliate.</div>`,
    `${button("Cancel", { goto: "affiliate" })}${button("Change referrer", { primary: true, disabled: true, reason: "Give a reason first" })}<span class="af-reason">Give a reason first</span>`);

  /* Q19 — only vendors with no referrer, and only within 30 days of sign-up. */
  const ATTACHABLE = [
    { n: "Sunrise Dance Studio", up: "2 Nov 2026", age: "9 days ago", ok: true },
    { n: "Greenfield Archery", up: "20 Oct 2026", age: "22 days ago", ok: true },
    { n: "Old Town Bowling", up: "3 Sep 2026", age: "69 days ago", ok: false },
  ];
  const attachModal = () => modal("Credit a vendor to Rina Dela Paz", "affiliate", `
    <p class="af-fine cm-modal-lead">For a vendor that signed up without a code, or was created in Command. Only vendors with no referrer are listed, and only within 30 days of their sign-up.</p>
    <ul class="cm-pick" aria-label="Vendors with no referrer">
      ${each(ATTACHABLE, (v, i) => `
        <li data-ok="${v.ok ? "1" : "0"}"${i === 0 ? ' data-on="1"' : ""}>
          <span class="cm-pick-name"><b>${esc(v.n)}</b><span>Signed up ${esc(v.up)} · ${esc(v.age)}</span></span>
          ${v.ok ? (i === 0 ? '<span class="af-badge" data-code="current">Selected</span>' : '<span class="af-badge" data-vst="active">Eligible</span>') : '<span class="af-badge" data-vst="suspended">Past 30 days</span>'}
        </li>`)}
    </ul>
    ${fld("at-why", "Reason", area("at-why", "Rina introduced the owner at the October trade fair; the owner signed up without the code.", ""), "Required. Credit runs from today, not from the sign-up date.")}`,
    `${button("Cancel", { goto: "affiliate" })}${button("Credit Sunrise Dance Studio to Rina", { primary: true })}`);

  /* ── Staff affiliate (Q48) ─────────────────────────────────────────────────────────────── */
  const staffBody = () => `
    <div class="cm-back">${button("← All affiliates", { goto: "affiliates" })}</div>
    <div class="af-waiting" role="note">${icon("alert", 16)}<p><b>Staff affiliate: paid through payroll.</b> Nina sees her balance but has no Withdraw button. When payroll pays her commission, record it here so her balance and history stay right.</p></div>
    <div class="af-grid af-grid-top">
      <div class="af-col">
        ${card(`
          <div class="af-card-head">
            <div><p class="af-card-title">Balance</p><p class="af-card-sub">Rate 1% of Ezzy's fee after tax (default)</p></div>
            <p class="af-big">${peso(3.1)}</p>
          </div>
          ${kv([["Available", `<b>${peso(3.1)}</b>`], ["Earned, not yet available", peso(0.82)], ["Paid through payroll to date", peso(9.44)]])}
          <div class="af-code-actions af-actions-top">${button("Record payroll payment", { goto: "payroll", primary: true })}</div>`, "rs-card")}
        ${card(`
          <p class="af-card-title">Payroll payments</p>
          <table class="af-table is-full af-stable">
            <thead><tr><th scope="col">Ref</th><th scope="col">Payroll date</th><th scope="col">Recorded by</th><th scope="col" class="num">Amount</th></tr></thead>
            <tbody>
              <tr><td data-label="Ref" class="af-ref">W-1008</td><td data-label="Payroll date">30 Oct 2026</td><td data-label="Recorded by">Ops Admin</td><td data-label="Amount" class="num af-share">${peso(5.12)}</td></tr>
              <tr><td data-label="Ref" class="af-ref">W-1002</td><td data-label="Payroll date">30 Sep 2026</td><td data-label="Recorded by">Ops Admin</td><td data-label="Amount" class="num af-share">${peso(4.32)}</td></tr>
            </tbody>
          </table>`, "rs-card")}
      </div>
      <div class="af-col af-col-side">
        ${card(`
          <p class="af-card-title">Nina Santos</p>
          ${kv([["Email", "nina@example.com"], ["Type", "Staff"], ["Account", '<span class="af-badge" data-vst="active">Active</span>'], ["Payout details", "Not needed"]])}
          <p class="af-fine">Nina cannot record her own payroll payment or change her own rate: the system refuses it, whoever is signed in as her.</p>`, "rs-card")}
      </div>
    </div>`;
  const staff = (overlay = "") => () => shell("affiliates", "Nina Santos", "Affiliate · NINA2026 · Staff", staffBody(), overlay);

  const payrollModal = () => modal("Record payroll payment", "affiliate-staff", `
    <p class="af-fine cm-modal-lead">For Nina Santos. This records that payroll paid her whole available balance. No transfer is made from here and no email is sent.</p>
    ${kv([["Amount (whole available balance)", `<b>${peso(3.1)}</b>`], ["Lines covered", "2"]])}
    ${fld("py-date", "Payroll date", input("py-date", "2026-11-13", 'type="date"'))}
    ${fld("py-ref", "Payroll reference", input("py-ref", "", 'placeholder="Payslip or batch number"'), "Required.")}`,
    `${button("Cancel", { goto: "affiliate-staff" })}${button("Record payment", { primary: true, disabled: true, reason: "Enter the payroll reference first" })}<span class="af-reason">Enter the payroll reference first</span>`);

  /* ── Withdrawals queue ─────────────────────────────────────────────────────────────────── */
  const withdrawals = () => shell("affiliates", "Affiliates", "Withdrawal requests, oldest first. You send the money yourself, then mark it here.", `
    ${subtabs("withdrawals")}
    <div class="af-chips cm-filter" role="group" aria-label="Filter by status">
      <button type="button" class="af-chip is-on" aria-pressed="true">Open<span class="cm-count">2</span></button>
      <button type="button" class="af-chip" aria-pressed="false">Completed</button>
      <button type="button" class="af-chip" aria-pressed="false">Rejected</button>
      <button type="button" class="af-chip" aria-pressed="false">All</button>
    </div>
    ${pvnote("Preview: the list shows every status at once so each can be reviewed; the chips are drawn, not wired.")}
    ${card(`
      <table class="af-table is-full">
        <thead><tr>
          <th scope="col">Ref</th><th scope="col">Affiliate</th><th scope="col" class="num">Amount</th>
          <th scope="col">Pay to</th><th scope="col">Requested</th><th scope="col">Status</th><th scope="col"><span class="cm-sr">Open</span></th>
        </tr></thead>
        <tbody>
          ${each(WITHDRAWALS, (w) => `
            <tr data-w="${w.st}">
              <td data-label="Ref" class="af-ref">${esc(w.ref)}</td>
              <td data-label="Affiliate"><b>${esc(w.who)}</b>${w.note ? `<span class="af-note">${esc(w.note)}</span>` : ""}</td>
              <td data-label="Amount" class="num af-share">${peso(w.amt)}</td>
              <td data-label="Pay to">${esc(w.dest)}</td>
              <td data-label="Requested">${esc(w.when)}</td>
              <td data-label="Status">${wbadge(w)}</td>
              <td data-label="" class="cm-rowact">${w.open ? button("Open", { goto: w.open, primary: w.st === "requested" }) : ""}</td>
            </tr>`)}
        </tbody>
      </table>`, "rs-card af-tablecard")}
    <p class="af-fine">Each admin was notified in Command and by email when W-1012 came in. Affiliates are told withdrawals are processed within 5 business days.</p>`);

  /* ── One withdrawal ────────────────────────────────────────────────────────────────────── */
  const steps = (at) => `
    <ol class="af-steps" aria-label="Progress of this withdrawal">
      ${each(["Requested", "Processing", "Completed"], (label, i) => `<li data-s="${i < at ? "done" : i === at ? "now" : "todo"}"${i === at ? ' aria-current="step"' : ""}>${esc(label)}</li>`)}
    </ol>`;

  const requestedBody = () => `
    <div class="cm-back">${button("← Withdrawals", { goto: "withdrawals" })}</div>
    <div class="af-grid af-grid-top">
      <div class="af-col">
        ${card(`
          <div class="af-card-head">
            <div><p class="af-card-title">W-1012 · Rina Dela Paz</p><p class="af-card-sub">Requested 11 Nov 2026, 9:14 am · her whole available balance</p></div>
            <p class="af-big">${peso(5.85)}</p>
          </div>
          ${steps(0)}
          <p class="af-fine">Rina can still cancel this. <b>Start processing</b> locks it so she cannot, and re-checks every line: if a booking was refunded or flagged since she asked, that line drops out and the amount changes before you send anything.</p>
          ${lineTable(W1012)}
          <div class="af-code-actions af-actions-top">
            ${button("Start processing", { primary: true, goto: "withdrawal-processing" })}
            ${button("Reject", { goto: "withdrawal-reject" })}
          </div>`, "rs-card")}
      </div>
      <div class="af-col af-col-side">
        ${card(`
          <p class="af-card-title">Pay to</p>
          <p class="af-dest"><b>BDO Unibank</b><span>••••••••7890</span></p>
          <p class="af-fine">The full account details are shown once you start processing.</p>`, "rs-card")}
        ${card(`
          <p class="af-card-title">Checks</p>
          <ul class="af-rules cm-checks">
            <li data-ok="1">Payout details on file</li>
            <li data-ok="1">At or above the ${peso(5)} minimum</li>
            <li data-ok="1">No other open withdrawal</li>
            <li data-ok="1">Affiliate is active, not staff</li>
          </ul>`, "rs-card")}
      </div>
    </div>`;
  const withdrawal = (overlay = "") => () => shell("affiliates", "Withdrawal W-1012", "", requestedBody(), overlay);

  const rejectModal = () => modal("Reject W-1012", "withdrawal", `
    <p class="af-fine cm-modal-lead">Rina's ${peso(5.85)} goes back to her available balance and she can request again. She is emailed your reason.</p>
    ${fld("rj-why", "Reason shown to the affiliate", area("rj-why", "", "For example: the account name does not match your name. Please contact support to correct it."), "Required. Write it for the affiliate to read.")}`,
    `${button("Cancel", { goto: "withdrawal" })}${button("Reject withdrawal", { primary: true, disabled: true, reason: "Give a reason first" })}<span class="af-reason">Give a reason first</span>`);

  /* Processing: the one place the full destination is shown, as vendor's "Show full details"
     (command/components/payouts/PayoutDetailModal) — decrypting records the access. */
  const processing = () => shell("affiliates", "Withdrawal W-1012", "", `
    <div class="cm-back">${button("← Withdrawals", { goto: "withdrawals" })}</div>
    <div class="af-grid af-grid-top">
      <div class="af-col">
        ${card(`
          <div class="af-card-head">
            <div><p class="af-card-title">W-1012 · Rina Dela Paz</p><p class="af-card-sub">Started 11 Nov 2026, 10:02 am by you · re-checked: all 5 lines still valid</p></div>
            <p class="af-big">${peso(5.85)}</p>
          </div>
          ${steps(1)}
          <p class="af-fine">Locked: Rina can no longer cancel. Send exactly <b>${peso(5.85)}</b> to the account on the right, then record the transfer below. Ezzy pays the transfer fee; nothing is deducted.</p>`, "rs-card")}
        ${card(`
          <p class="af-card-title">Mark as completed</p>
          <p class="af-card-sub">Only after the money has left Ezzy's account</p>
          <div class="cm-formgrid">
            ${fld("cp-how", "Sent by", select("cp-how", ["InstaPay", "PESONet", "GCash", "Maya", "Other"], "InstaPay"))}
            ${fld("cp-date", "Date sent", input("cp-date", "2026-11-11", 'type="date"'))}
          </div>
          ${fld("cp-ref", "Transfer reference", input("cp-ref", "", 'placeholder="From the bank or wallet confirmation"'), "Required. Rina sees it on her receipt.")}
          <div class="af-code-actions af-actions-top">
            ${button("Mark as completed", { primary: true, disabled: true, reason: "Enter the transfer reference first" })}
            ${button("Reject instead", { goto: "withdrawal-reject" })}
            <span class="af-reason">Enter the transfer reference first</span>
          </div>
          <p class="af-fine">Completing marks the 5 lines as withdrawn and emails Rina a receipt. It cannot be undone from here.</p>`, "rs-card")}
        ${card(`<p class="af-card-title">Lines in this withdrawal</p>${lineTable(W1012)}`, "rs-card")}
      </div>
      <div class="af-col af-col-side">
        ${card(`
          <p class="af-card-title">Pay to</p>
          <div class="cm-reveal">
            ${kv([["Paid by", "Bank transfer"], ["Bank", "BDO Unibank"], ["Account name", "Rina Dela Paz"], ["Account number", '<b class="cm-acct">0012 3456 7890</b>']])}
          </div>
          <p class="af-fine">Full details shown because you asked. This view was recorded: you, 11 Nov 2026, 10:02 am.</p>`, "rs-card")}
      </div>
    </div>`);

  /* ── Settings (Q34, Q35, Q45) ──────────────────────────────────────────────────────────── */
  const settings = (set) => () => shell("settings", "Settings", "", `
    <div class="af-chips" role="group" aria-label="Settings sections">
      <button type="button" class="af-chip is-on" aria-pressed="true">Platform Fee</button>
      <span class="af-chip is-inert">Notifications</span><span class="af-chip is-inert">Divisions</span><span class="af-chip is-inert">Security</span>
    </div>
    ${card(`
      <p class="af-card-title">Platform fee and vendor withholding</p>
      <p class="af-card-sub">Exists today; shown for context, unchanged by this work</p>
      ${kv([["Commission rate", "11.00%"], ["Vendor withholding tax", "1.00% of 50.00% of the payout"]])}`, "rs-card cm-existing")}
    ${pvnote("New in this work: the card below. It sits under the two existing cards on the Platform Fee tab.")}
    ${set ? "" : `<div class="af-waiting" role="status">${icon("alert", 16)}<p><b>Affiliate commission is switched off.</b> No commission is calculated until the tax rate is set, and affiliates cannot withdraw until a minimum is set. Nothing is lost by waiting: bookings completed before the tax rate is set earn no commission.</p></div>`}
    ${card(`
      <p class="af-card-title">Affiliate commission</p>
      <p class="af-card-sub">Applies to every affiliate unless one has a rate override</p>
      <div class="cm-set">
        ${fld("st-tax", "Tax taken off Ezzy's fee before commission (%)", input("st-tax", set ? "12.00" : "", 'inputmode="decimal" placeholder="Not set"'), set ? "Stored on each commission line when its booking completes." : "Not set: no commission is being calculated.")}
        ${fld("st-rate", "Default affiliate rate (% of the fee after tax)", input("st-rate", "1.00", 'inputmode="decimal"'), "An affiliate's own override, if any, wins.")}
        ${fld("st-min", "Minimum withdrawal (₱)", input("st-min", set ? "5.00" : "", 'inputmode="decimal" placeholder="Not set"'), set ? "Affiliates can withdraw once their available balance reaches this." : "Not set: withdrawals are off for everyone.")}
      </div>
      ${set ? `<div class="af-keep" role="note"><b>Example.</b> A ₱1,600.00 booking: Ezzy's fee ₱176.00 → ₱154.88 after 12.00% tax → the affiliate earns ₱1.55. At this rate the ₱5.00 minimum is reached after about ₱5,165 of bookings.</div>` : ""}
      <div class="af-code-actions af-actions-top">
        ${set ? button("Save changes", { primary: true, disabled: true, reason: "Nothing has changed" }) + '<span class="af-reason">Nothing has changed</span>'
              : button("Save", { primary: true, disabled: true, reason: "Enter the tax rate or the minimum first" }) + '<span class="af-reason">Enter the tax rate or the minimum first</span>'}
      </div>
      <p class="af-fine">A change applies to bookings completed from then on. Commission already earned keeps the rates it was earned at. Every change is recorded with your name.</p>`, "rs-card")}`);

  window.PREVIEW_SCREENS = [
    { id: "affiliates",            label: "Affiliates · list",                      render: affiliates },
    { id: "affiliate",             label: "Affiliate · detail",                     render: affiliate() },
    { id: "payout-details",        label: "Affiliate · replace payout details",     render: affiliate(payoutModal()) },
    { id: "change-referrer",       label: "Affiliate · change a vendor's referrer", render: affiliate(referrerModal()) },
    { id: "attach-vendor",         label: "Affiliate · credit a vendor",            render: affiliate(attachModal()) },
    { id: "affiliate-staff",       label: "Staff affiliate · detail",               render: staff() },
    { id: "payroll",               label: "Staff affiliate · record payroll",       render: staff(payrollModal()) },
    { id: "withdrawals",           label: "Withdrawals · queue",                    render: withdrawals },
    { id: "withdrawal",            label: "Withdrawal · requested",                 render: withdrawal() },
    { id: "withdrawal-reject",     label: "Withdrawal · reject",                    render: withdrawal(rejectModal()) },
    { id: "withdrawal-processing", label: "Withdrawal · processing, complete",      render: processing },
    { id: "settings",              label: "Settings · not set yet",                 render: settings(false) },
    { id: "settings-set",          label: "Settings · set",                         render: settings(true) },
  ];
})();
