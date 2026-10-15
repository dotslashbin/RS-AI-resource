// Offering creation wizard — static preview controller.
// Fixed fixture states only: nothing is saved, no network, no app imports.
// Query params: ?screen=<id>&theme=light|dark&chrome=0 (chrome=0 hides the preview bar).
"use strict";

const ICON = {
  x:       '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  plus:    '<path d="M5 12h14"/><path d="M12 5v14"/>',
  trash:   '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  left:    '<path d="m15 18-6-6 6-6"/>',
  right:   '<path d="m9 18 6-6-6-6"/>',
  check:   '<path d="M20 6 9 17l-5-5"/>',
  ok:      '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  alert:   '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  image:   '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  pencil:  '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  cal:     '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  save:    '<path d="M20 6 9 17l-5-5"/>',
};
const ic = (n, s = 14) => `<svg class="ic s${s}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

const STEPS = [
  { title: "The basics",
    help: "Name what you offer and give it a short code customers will see. Nothing is saved yet." },
  { title: "Price and length",
    help: "Set what one booking costs and how long it lasts. Leave price at 0 if it's free." },
  { title: "How it works",
    help: "Tell us how a booking is completed, and anything customers must upload when they book." },
  { title: "Check and save",
    help: "Check your offering. <strong>Saving creates it</strong> — after this you can add photos, but details are changed later with Edit." },
  { title: "Photos and documents",
    help: "Optional. Add a photo for the kiosk — without one it shows your short code — and any documents customers must accept before paying. Each one is saved as you add it." },
];

// Fixture values: a filled-in offering, and an empty one.
const FILLED = { name: "Court B — Hourly", code: "COURTB", cat: "Rental", desc: "Indoor hard court with lights. Rackets available at the desk.", price: "850", qty: "1", unit: "hour" };
const EMPTY  = { name: "", code: "", cat: "", desc: "", price: "", qty: "1", unit: "hour" };

// screen id → [label, step index, overrides]
const SCREENS = {
  "basics-empty": ["1 · The basics — empty (Next disabled)", 0, { v: EMPTY }],
  "basics":       ["1 · The basics — filled", 0, {}],
  "basics-dupe":  ["1 · The basics — short code already used", 0, { v: { ...FILLED, code: "RENT" }, dupe: true }],
  "price":        ["2 · Price and length", 1, {}],
  "how":          ["3 · How it works", 2, {}],
  "how-blank":    ["3 · How it works — blank requirement (Next disabled)", 2, { blankReq: true }],
  "review":       ["4 · Check and save", 3, {}],
  "review-free":  ["4 · Check and save — price left blank shows as Free", 3, { free: true }],
  "review-error": ["4 · Check and save — save failed", 3, { saveError: true }],
  "photos":       ["5 · Photos and documents (saved, no Back)", 4, {}],
  "discard":      ["Cancel before saving — discard confirm", 1, { discard: true }],
  "prompt":       ["After Finish — existing schedule prompt", 4, { prompt: true }],
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function stepBody(i, o) {
  const v = o.v || FILLED;
  if (i === 0) return `
    <div class="fields">
      <div><p class="lbl">Offering Name <span class="req">*</span></p>
        <input class="sp-input" value="${esc(v.name)}" placeholder="e.g. 1-Hour Court Rental"></div>
      <div class="row">
        <div><p class="lbl">Short Code <span class="req">*</span></p>
          <input class="sp-input code${o.dupe ? " invalid" : ""}" value="${esc(v.code)}" placeholder="e.g. RENT" ${o.dupe ? 'aria-invalid="true" aria-describedby="code-err"' : ""}>
          ${o.dupe ? `<p class="field-err" id="code-err">${ic("alert", 12)}<span>You already have an offering with the code RENT. Pick a different one.</span></p>` : `<p class="hint">Up to 6 letters or numbers.</p>`}
        </div>
        <div><p class="lbl">Category</p>
          <input class="sp-input" value="${esc(v.cat)}" placeholder="e.g. Rental, Coaching, Class"></div>
      </div>
      <div><p class="lbl">Description</p>
        <textarea class="sp-input" rows="3" placeholder="Briefly describe this offering…">${esc(v.desc)}</textarea></div>
    </div>`;
  if (i === 1) return `
    <div class="fields">
      <div class="row">
        <div><p class="lbl">Price (PHP) <span class="lbl-sub">per hour</span></p>
          <input class="sp-input" type="number" value="850" placeholder="e.g. 850"></div>
        <div><p class="lbl">Duration <span class="req">*</span></p>
          <div class="dur"><input class="sp-input q" type="number" value="1"><select class="sp-input"><option>hour</option></select></div></div>
      </div>
      <p class="hint hint-tight">One booking = 1 hour</p>
    </div>`;
  if (i === 2) return `
    <div class="fields">
      <div><p class="lbl">How is this completed?</p>
        <button class="pattern on"><p class="pattern-t">I complete it, then the customer confirms</p>
          <p class="pattern-b">For exams, lessons, consultations, treatments and callouts. You mark it done and the customer confirms — or it confirms itself after 3 days.</p></button>
        <button class="pattern"><p class="pattern-t">The customer takes something and brings it back</p>
          <p class="pattern-b">For vehicles, equipment, rooms, courts and bays. You hand it over, the customer tells us they've returned it, and you confirm.</p></button>
      </div>
      <div><p class="lbl">Requirements</p>
        <div class="req-row"><input class="sp-input" value="Valid Government ID"><button class="chip on">Required</button><button class="icon-btn" aria-label="Remove requirement">${ic("trash", 13)}</button></div>
        ${o.blankReq ? `<div class="req-row"><input class="sp-input invalid" value="" placeholder="e.g. Valid Government ID" aria-invalid="true"><button class="chip on">Required</button><button class="icon-btn" aria-label="Remove requirement">${ic("trash", 13)}</button></div>
        <p class="field-err">${ic("alert", 12)}<span>Fill in this requirement or remove it.</span></p>` : ""}
        <button class="link-btn">${ic("plus", 13)} Add requirement</button>
      </div>
    </div>`;
  if (i === 3) return `
    <section class="rv"><div class="rv-head"><span class="rv-title">The basics</span><button class="rv-change">Change</button></div>
      <div class="rv-body">
        <div class="rv-line"><span class="rv-k">Name</span><span class="rv-v">${esc(FILLED.name)}</span></div>
        <div class="rv-line"><span class="rv-k">Short code</span><span class="rv-v">${FILLED.code}</span></div>
        <div class="rv-line"><span class="rv-k">Category</span><span class="rv-v">${FILLED.cat}</span></div>
        <div class="rv-line"><span class="rv-k">Description</span><span class="rv-v">${esc(FILLED.desc)}</span></div>
      </div></section>
    <section class="rv"><div class="rv-head"><span class="rv-title">Price and length</span><button class="rv-change">Change</button></div>
      <div class="rv-body">
        ${o.free
          ? `<div class="rv-line"><span class="rv-k">Price</span><span class="rv-v free">Free (₱0)</span></div>`
          : `<div class="rv-line"><span class="rv-k">Price</span><span class="rv-v">₱850.00 per hour</span></div>`}
        <div class="rv-line"><span class="rv-k">One booking</span><span class="rv-v">1 hour</span></div>
      </div></section>
    <section class="rv"><div class="rv-head"><span class="rv-title">How it works</span><button class="rv-change">Change</button></div>
      <div class="rv-body">
        <div class="rv-line"><span class="rv-k">Completed by</span><span class="rv-v">You complete it, then the customer confirms</span></div>
        <div class="rv-line"><span class="rv-k">Customers upload</span><span class="rv-v">Valid Government ID · required</span></div>
      </div></section>
    <div class="sp-pill switch-row">
      <div><p class="switch-t">Active</p><p class="switch-b">Inactive offerings won't appear in booking options</p></div>
      <button class="switch" role="switch" aria-checked="true" aria-label="Active"></button>
    </div>
    ${o.saveError ? `<div class="alert alert-err" role="alert">${ic("alert", 15)}<span>We couldn't save your offering. Your session may be stale — reload the page and try again. Nothing was saved.</span></div>` : ""}`;
  return `
    <div class="alert alert-ok" role="status">${ic("ok", 15)}<span><strong>Saved.</strong> Change details later with Edit on the offering card.</span></div>
    <div class="att-sec">
      <div class="att-head"><p class="att-h">Photos</p><span class="badge badge-pub">PUBLIC</span><span class="counter">0 of 1 used</span></div>
      <p class="att-note">Shown on the kiosk when a customer picks this offering. Anyone with the link can view these — don't put documents here.</p>
      <button class="add-tile">${ic("image", 16)}Add photo</button>
    </div>
    <div class="att-sec">
      <div class="att-head"><p class="att-h">Documents</p><span class="badge badge-priv">PRIVATE</span></div>
      <p class="att-note">Optional. Customers must read and accept every document here before they can pay — add none and they go straight from their details to payment.</p>
      <p class="empty">No documents — nothing to accept before payment.</p>
      <div class="att-actions"><button class="link-btn">${ic("plus", 13)} Upload a file</button><button class="link-btn">${ic("pencil", 13)} Write text</button></div>
    </div>`;
}

function footer(i, o) {
  if (o.discard) return `
    <div class="confirm" role="alertdialog" aria-labelledby="dc-t" aria-describedby="dc-b">
      <p class="confirm-t" id="dc-t">Discard this offering?</p>
      <p class="confirm-b" id="dc-b">Nothing has been saved yet. Everything you've entered will be lost.</p>
      <div class="foot-row"><button class="btn-back" data-go="price">Keep editing</button><button class="btn-danger" data-go="basics-empty">Discard</button></div>
    </div>`;
  const disabled = (i === 0 && (o.v === EMPTY)) || o.blankReq;
  let hint = "";
  if (i === 0 && o.v === EMPTY) hint = "Add a name and a short code to continue.";
  if (o.blankReq) hint = "Fill in or remove the blank requirement to continue.";
  const prev = { 1: "basics", 2: "price", 3: "how" }[i];
  const next = { 0: o.dupe ? "basics-dupe" : "price", 1: "how", 2: "review", 3: "photos", 4: "prompt" }[i];
  const back = i === 0
    ? `<button class="btn-back" data-go="discard">Cancel</button>`
    : i === 4 ? "" : `<button class="btn-back" data-go="${prev}">${ic("left")} Back</button>`;
  const label = i === 3 ? `${ic("save")} Save offering` : i === 4 ? "Finish" : `Next ${ic("right")}`;
  return `
    <div class="wiz-foot">
      ${hint ? `<p class="foot-hint">${ic("alert", 13)}<span>${hint}</span></p>` : ""}
      ${i === 3 && !o.saveError ? `<p class="foot-note">Saving creates the offering. You can still add photos next.</p>` : ""}
      <div class="foot-row">${back}<button class="btn-primary btn-next" data-go="${next}" ${disabled ? "disabled" : ""}>${label}</button></div>
    </div>`;
}

function render(screen) {
  const [, i, o] = SCREENS[screen];
  const saved = i === 4;
  const progress = STEPS.map((_, k) =>
    `<li class="${k < i ? (saved ? "locked" : "done") : k === i ? "current" : ""}" ${k === i ? 'aria-current="step"' : ""}><span hidden>${STEPS[k].title}</span></li>`).join("");
  const wizard = `
    <div class="overlay"></div>
    <div class="wiz" role="dialog" aria-modal="true" aria-labelledby="wiz-t" aria-describedby="wiz-d">
      <div class="wiz-head">
        <div class="wiz-titlerow">
          <h2 class="wiz-title" id="wiz-t">Add an offering</h2>
          <button class="wiz-close" aria-label="${saved ? "Close — your offering is saved" : "Close the offering wizard"}" data-go="${saved ? "prompt" : "discard"}">${saved ? "Close " : ""}${ic("x", 18)}</button>
        </div>
        <p class="wiz-steptext">Step ${i + 1} of 5 — ${STEPS[i].title}${saved ? ` · <span class="wiz-saved">Saved</span>` : ""}</p>
        <ol class="progress" aria-label="Progress">${progress}</ol>
      </div>
      <div class="wiz-body">
        <h3 class="step-heading" tabindex="-1">${STEPS[i].title}</h3>
        <p class="step-help" id="wiz-d">${STEPS[i].help}</p>
        ${stepBody(i, o)}
      </div>
      ${footer(i, o)}
    </div>`;
  const prompt = `
    <div class="overlay"></div>
    <div class="prompt" role="dialog" aria-modal="true">
      <p class="prompt-tag">Existing component — unchanged</p>
      <p class="prompt-t">${ic("ok", 18)} Offering saved</p>
      <p class="prompt-b">Set up when "${esc(FILLED.name)}" is available so customers can book it.</p>
      <div class="prompt-row"><button class="sp-pill" data-go="basics-empty">Not now</button><button class="btn-primary" data-go="basics-empty">${ic("cal")} Set up schedule</button></div>
    </div>`;
  document.getElementById("root").innerHTML = o.prompt ? prompt : wizard;
}

function apply() {
  const p = new URLSearchParams(location.search);
  const screen = SCREENS[p.get("screen")] ? p.get("screen") : "basics-empty";
  const theme = p.get("theme") === "dark" ? "dark" : "light";
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("no-chrome", p.get("chrome") === "0");
  document.getElementById("pv-screen").value = screen;
  document.getElementById("pv-theme").value = theme;
  render(screen);
}

function go(params) {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(params)) p.set(k, v);
  history.replaceState(null, "", "?" + p.toString());
  apply();
}

document.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("pv-screen");
  sel.innerHTML = Object.entries(SCREENS).map(([id, [label]]) => `<option value="${id}">${label}</option>`).join("");
  sel.addEventListener("change", e => go({ screen: e.target.value }));
  document.getElementById("pv-theme").addEventListener("change", e => go({ theme: e.target.value }));
  document.getElementById("root").addEventListener("click", e => {
    const t = e.target.closest("[data-go]");
    if (t && !t.disabled) go({ screen: t.dataset.go });
  });
  apply();
});
