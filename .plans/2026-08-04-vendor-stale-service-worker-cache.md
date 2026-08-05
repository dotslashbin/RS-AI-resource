# Vendor: stale service-worker cache serves pre-migration JS

**Date:** 2026-08-04
**App / scope:** `vendor/` — `public/sw.js`, `components/layout/AppShell/useAppShell.ts`, `components/offerings/OfferingsPage/useOfferingsPage.ts`
**Status:** DRAFT — **diagnosis CONFIRMED by the user 2026-08-04**: clearing the
browser cache restored both the offerings list and the create form. **One decision
OPEN (D1), which blocks execution.**

> Two symptoms, one cause. The database and the app source are both correct; the
> **browser** is running JS from before the duration migration, served cache-first
> by the PWA service worker. Optimise for: never shipping a stale bundle against a
> migrated schema again, and never rendering a failed fetch as an empty list.

> **Status legend:** ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ PARKED · ✖ ABORTED.
> **Numbering legend:** B# = Blocker, I# = Important; numbers are plan-local —
> qualify cross-plan refs by app (e.g. "command I1").

---

## 0. Immediate unblock (do this first — no code required)

The reported error clears with a one-off cache purge. In DevTools:

**Application → Service Workers → Unregister**, then **Application → Storage →
Clear site data**, then hard-reload.

Or from the console on the vendor origin:

```js
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
caches.keys().then(ks => ks.forEach(k => caches.delete(k)))
location.reload()
```

Both symptoms should disappear together. **That is a workaround, not the fix** —
B1 exists so the next schema change does not do this again, to you or to a booker.

---

## 1. Diagnosis

### 1.1 What was reported

1. Logged in as `maria@bookdeck.com`, the Offerings page shows **no offerings**,
   where a previous version showed several.
2. Creating an offering (duration "1 Day") fails with
   **`Could not find the 'duration' column of 'offerings' in the schema cache`**.

### 1.2 What is actually true — verified, not assumed

| Claim | Checked | Result |
|---|---|---|
| The data is missing | `psql` against local | ❌ **False alarm.** Maria is a vendor-admin at 3 vendors holding **4 + 3 + 3 = 10 offerings** |
| The migration half-applied | `information_schema.columns` | ❌ False alarm. `offerings.duration` is correctly **absent**; all 5 migrations recorded |
| The app source still sends `duration` | `grep -rn "duration:"` across `vendor/`, excluding `node_modules`/`.next` | ❌ **Zero hits.** No code path in the repo can send that column |
| The build is stale | `stat .next` vs `services/offerings.service.ts` | ❌ False alarm. `.next` (Aug 4 10:33) is **newer** than the source (Aug 3 21:05) |

So: correct database, correct source, correct build — and a browser sending a column
that no longer exists in any of them. The only remaining place that JS can come from
is the browser's own cache.

### 1.2b Confirmed

A second pass chased a possible stale dev server and ruled it out — the running
`next dev` post-dates every source change, the on-disk client chunks are clean, and
the **actually-served** `page.js` contains `duration_minutes` and no offering-column
`duration` (its three `duration:` hits are a Supabase doc comment, a CSS
`animation-duration`, and sonner's toast prop). Server side is clean at every layer.
The user then cleared the browser cache and both symptoms went away.

### 1.3 The cause

**`public/sw.js:30-44` is cache-first for every same-origin GET that is not a
navigation** — which is exactly the Next.js JS chunks:

```js
event.respondWith(
  caches.match(request).then((cached) => {
    if (cached) return cached        // ← returns stale chunks forever
    ...
  })
)
```

Three properties combine into this bug:

1. **`OFFLINE_CACHE = "offline-v1"` is a constant.** It is never bumped, and the
   `activate` handler (`:10`) only calls `clients.claim()` — it **never deletes old
   caches**. A chunk cached once is served until the user manually clears storage.
2. **Cross-origin is deliberately never intercepted** (`:20`). So the Supabase call
   *does* reach the live PostgREST — which is why the schema error is real and
   current even though the code making it is months old. This is why the symptom
   looks like a database problem.
3. **The SW registers unconditionally** (`useAppShell.ts:117-118`) — no
   `NODE_ENV` guard — so it is active on `localhost` during development, where
   chunk URLs are reused across rebuilds far more aggressively than in production.

### 1.4 Why the two symptoms look unrelated but are not

The stale bundle contains the **old** `offerings.service.ts`, which both selects and
inserts `duration`:

- **`getOfferings`** selects `duration` → PostgREST rejects the whole query →
  `useOfferingsPage.ts:26` runs `if (!error) setOfferings(data)` → offerings stay
  `[]` and **nothing is shown to the user**. That is symptom 1.
- **`createOffering`** inserts `duration` → the same rejection, this time surfaced
  because the form renders `saveError`. That is symptom 2.

One stale file, two faces. Symptom 1 is silent only because of I1 below.

### 1.5 This is a production hazard, not only a dev annoyance

The same mechanism applies to a deployed vendor PWA. Any user who had the app open
before a schema-changing deploy keeps their cached chunks **indefinitely**, because
nothing invalidates them. They would see exactly this: empty lists and schema-cache
errors, with a correct server. Booker has the identical service worker.

---

## 2. BLOCKERS

### B1 — The service worker can serve pre-migration JS forever  ⬜ TODO
**File:** `vendor/public/sw.js:1` (`OFFLINE_CACHE` constant), `:9-11` (activate), `:30-44` (cache-first)

A versionless cache plus an `activate` handler that never evicts means a cached
chunk outlives any number of deploys. Combined with cross-origin passthrough, an
old client talks to a new database — the worst pairing available, because the
server is right and the error blames the schema.

**Fix approach:** Two changes, both small:

1. **Evict on activate.** Delete every cache key that is not the current one:
   ```js
   self.addEventListener("activate", (event) => {
     event.waitUntil(
       caches.keys()
         .then(keys => Promise.all(keys.filter(k => k !== OFFLINE_CACHE).map(k => caches.delete(k))))
         .then(() => self.clients.claim())
     )
   })
   ```
2. **Make the cache name change per build**, so the eviction above actually fires.
   See **D1** — this is the open decision.

**Coupling:** `booker/public/sw.js` is the same file with the same defect. It is a
second app, so fixing both is a cross-app change and an approval gate under
`AGENTS.md`. Vendor alone is in scope here unless D1 says otherwise.

---

### B2 — The SW is active in development  ⬜ TODO
**File:** `vendor/components/layout/AppShell/useAppShell.ts:117-118`

```ts
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {})
}
```

No environment guard. In dev this buys nothing — offline fallback is not a thing
anyone needs on `localhost` — and costs exactly the bug reported here, on every
schema change, for every developer.

**Fix approach:** Register only in production, and **actively unregister** in dev so
existing installs (like the one that caused this) heal themselves rather than
requiring each developer to find the DevTools panel:

```ts
if (process.env.NODE_ENV === "production") {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {})
} else if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
}
```

The unregister branch is the part that matters for **this** incident: it turns the
§0 manual purge into something that happens on next load.

**Verification:** load the vendor dev server, confirm in DevTools → Application that
no service worker is registered, and that Offerings lists 4 items for Citywide.

---

## 3. IMPORTANT

### I1 — A failed offerings fetch renders as "no offerings"  ⬜ TODO
**File:** `vendor/components/offerings/OfferingsPage/useOfferingsPage.ts:26`

```ts
getOfferings(vendorId).then(({ data, error }) => { if (!error) setOfferings(data); setLoading(false) })
```

`error` is discarded. A failed fetch is indistinguishable from a vendor who has not
created any offerings yet — which is precisely why symptom 1 was reported as
"missing data" rather than "the request failed", and why the diagnosis started in
the database instead of the browser.

**This is the reason the incident was hard to read**, and it is worth fixing on its
own merits: a vendor whose network drops will be told, wrongly, that their catalogue
is empty.

**Fix approach:** Keep the error in state and render an error state distinct from
the empty state — the `ux-design` skill requires all four of loading / empty / error
/ populated, and this surface has three. The page already renders `saveError` for
writes; mirror that for reads.

**Component separation:** the error belongs in `useOfferingsPage.ts` alongside
`saveError`/`deleteError`; `OfferingsPage.tsx` stays a pure render layer and gains a
branch, not a fetch.

**Coupling with B1/B2:** independent. Worth doing even if D1 parks the SW work,
because it is what made a browser-cache problem look like a data problem.

---

### I2 — Audit the other read paths for the same silent-empty pattern  ⬜ TODO
**File:** `vendor/components/**/use*.ts` (and `booker/`, `command/` by extension)

`useOfferingsPage.ts:26` is unlikely to be the only `if (!error)` that swallows a
failure. Any list that renders empty on error will mislead in exactly the same way
the next time a fetch fails.

**Fix approach:** grep for `if (!error)` and `\.then\(\(\{ data` across the three
web apps; list the surfaces that discard the error; fix the ones on primary data
views. **Not a blanket refactor** — the aim is an inventory and a decision per
surface, not a mechanical rewrite.

---

## 4. DECISIONS

<!-- No item in this plan may execute while any OPEN: line below remains. -->

- **OPEN: D1 — how should the SW cache be versioned, and does `booker` ship with it?**
  B1's eviction only fires when the cache *name* changes, so something must vary it.
  - **(a) Bump `OFFLINE_CACHE` manually, vendor only.** *Recommended for now.*
    One-line change per release, no build wiring, no cross-app approval gate. The
    cost is that it depends on someone remembering — acceptable while the offline
    cache holds only `offline.html` plus incidental chunks.
  - **(b) Derive the cache name from the build ID.** Correct and automatic, but
    `sw.js` is a static file in `public/` and cannot read `.next/BUILD_ID`; it needs
    either a build step that templates the file or a `?v=` on the registration URL.
    More moving parts than this app currently has anywhere else.
  - **(c) Do (a) or (b) in `vendor` *and* `booker` together.** Honest — booker has
    the identical defect and a **worse** blast radius, since its users are the
    public rather than a handful of vendor admins. But it makes this a cross-app
    change, which `AGENTS.md` puts behind an approval gate.
  - **Blocks:** B1, and therefore the plan.

---

## 5. Not the cause — recorded so it is not re-investigated

- **The migrations.** All five applied; `offerings.duration` correctly dropped;
  `duration_minutes`/`duration_unit` present and populated.
- **The seed.** Maria's three vendors hold 10 offerings between them, including the
  date-granular `GEAR` row added for manual testing.
- **`db reset`.** It did what it should. The earlier Kong outage was a separate
  container-level fault and is unrelated to this.
- **PostgREST's own schema cache.** The error text names *the column the client
  sent*, not one PostgREST failed to refresh. A genuinely stale PostgREST cache
  would have complained about `duration_minutes` being unknown — the opposite.

---

## 6. Execution order

1. **§0 manual purge** — unblocks testing immediately, needs no code and no decision.
2. **B2** — dev-mode unregister. Independent of D1, and stops this recurring for
   every developer on every schema change.
3. **I1** — surface the read error. Independent; the reason this was misdiagnosed.
4. **B1** — cache versioning + eviction. **Blocked on D1.**
5. **I2** — the wider silent-empty audit. Do last; it is an inventory, not a fix.

---

## 7. Verification

| Item | Check | Kind |
|---|---|---|
| §0 | After purge, Offerings shows 4 for Citywide and the create form saves | **live** (browser) |
| B2 | Dev load registers no SW; an existing registration is removed on next load | **live** (browser, DevTools → Application) |
| B1 | Bump the cache name, reload twice, confirm old caches are gone from `caches.keys()` and new chunks are fetched | **live** (browser) |
| I1 | Force a read failure (stop Supabase, or point at a bad URL); assert an error state renders, **not** the empty state | **live** (browser) |
| I2 | Inventory produced and triaged | grep + review |
| All | `npx tsc --noEmit` and `npm run build` clean in `vendor` | machine |

⚠️ **`npm run lint` is unavailable in `vendor`** — a pre-existing config circularity
aborts before reading any file (see `.plans/2026-08-03-offering-duration-and-booking-units.md`
I14). Do not claim a lint pass on this work.
