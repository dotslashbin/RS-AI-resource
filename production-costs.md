# RS Platform — Production Cost Reference

_Last reviewed: June 2026. Verify current pricing at each provider before subscribing — these figures are accurate as of mid-2025 but may have changed._

---

## Service Overview

| Service | What it covers | Free tier | Paid tier | Need to subscribe? |
|---------|---------------|-----------|-----------|-------------------|
| **Vercel** | Hosting all 3 Next.js apps (learner, academy, command) | Hobby — personal use only, projects pause on inactivity | Pro — $20 USD/month (per seat) | ⭐ **Yes, at launch** — Hobby is not for commercial use |
| **Supabase** | Database, Auth, Storage, Realtime (1 shared project) | Free — 500MB DB, 5GB egress, 50k MAUs, projects pause after 1 week of inactivity | Pro — $25 USD/month (per project) | ⭐ **Yes, at launch** — free tier pauses inactive projects; not viable for production |
| **Resend** | Transactional email (booking confirmations, password reset, registration) | Free — 3,000 emails/month, max 100/day, 1 domain | Pro — $20 USD/month (50,000 emails/month, no daily cap, multiple domains, webhooks) | ✅ **Start on free** — upgrade when you hit the 100/day cap or need webhooks |
| **PayMongo** | Card, GCash, GrabPay, Maya, QRPh payments in the learner booking wizard | No monthly fee | No monthly fee — transaction cost only | ✅ **Already running** — no subscription needed |

---

## What You'll Actually Pay at Launch

Assuming a small launch: ~50–200 active learners, 3–10 academies, light email volume.

| Item | Cost/month (USD) | Notes |
|------|-----------------|-------|
| Vercel Pro | $20 | Covers all 3 apps under one team account. 1TB bandwidth included — more than enough at launch. |
| Supabase Pro | $25 | 8GB DB, 100GB storage, 250GB egress, daily backups, no pausing. 1 project shared by all apps. |
| Resend | $0 | Free tier handles ~100 emails/day. Sufficient until you have consistent daily booking volume. |
| **Total** | **$45/month** | Before transaction fees |

PayMongo fees are per transaction — only incurred when a learner pays:

| Payment method | Fee (approximate) |
|---------------|-------------------|
| Credit / debit card | 3.5% + ₱15 per transaction |
| GCash / Maya | 2.4% + ₱15 per transaction |
| GrabPay | 2.4% + ₱15 per transaction |
| QR Ph | 2.4% + ₱15 per transaction |

Example: a ₱850 TDC booking paid by GCash costs roughly ₱35.40 in fees (2.4% × 850 + 15).

---

## When to Upgrade

| Trigger | Action |
|---------|--------|
| Daily emails consistently hitting 100 | Upgrade Resend to Pro ($20/month) |
| Database approaching 8GB | Upgrade Supabase to Pro's compute add-ons, or review data retention |
| Team grows beyond 1 developer | Each additional Vercel seat is $20/month |
| Need Supabase read replicas or higher compute | Supabase compute add-ons start at $10/month |
| Bandwidth spikes (video, large file uploads) | Vercel: $0.15/GB overage; Supabase: $0.09/GB egress overage |

---

## Free Tier Limits — Why They Break in Production

**Vercel Hobby (free):**
- Terms explicitly prohibit commercial use
- No SLA — acceptable for prototyping, not for a live product

**Supabase Free:**
- Projects are **paused after 7 days of inactivity** — a learner trying to log in on day 8 would see a cold-start error
- No point-in-time recovery or daily backups
- 2-project limit (you only need 1, so this isn't the issue — pausing is)

**Resend Free:**
- 100 emails/day hard cap — a busy booking day with confirmations, rejections, and password resets could hit this quickly
- No webhook events (needed later for email delivery tracking)

---

## Notes

- All three Vercel apps can live under a single Pro team account ($20 flat, not per app).
- Supabase Pro covers the one shared project used by all three apps. You do not pay per portal.
- Custom domains are free on both Vercel Pro and Resend Pro.
- PayMongo has no setup fee or monthly charge — you only pay when a transaction succeeds.
- This does not include domain registration costs (~$10–15 USD/year per domain, purchased separately from a registrar like Namecheap or Cloudflare).
