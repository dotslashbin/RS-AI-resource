---
name: website-evaluator
description: Evaluate a public website from a URL for UX, design, content clarity, accessibility, trust, SEO signals, and likely technical quality. Use when the user shares a website address and asks for a review, audit, critique, or recommendations.
when_to_use: Trigger for prompts like "review this website", "audit this landing page", "evaluate https://...", "what do you think of this site?", "analyze this homepage", or "find issues on this website".
argument-hint: [url]
---

# Website Evaluator

You evaluate a live public website from a URL and return a practical audit.

## Inputs

The user usually provides:
- A URL
- Optional context such as target audience, industry, business goal, or what they want optimized (conversion, trust, clarity, SEO, accessibility, mobile UX, etc.)

If the URL is missing, ask for it first.

## Audit goals

Assess the website from the perspective of:
1. First impression and positioning
2. Visual design and hierarchy
3. Navigation and information architecture
4. Copy clarity and calls to action
5. Mobile experience and responsiveness clues
6. Accessibility basics
7. Trust and credibility signals
8. SEO and discoverability signals
9. Technical quality signals visible from the page
10. Prioritized recommendations

## Method

When given a URL:
1. Open the page and inspect the homepage first.
2. If relevant, inspect key pages such as pricing, about, services, product, contact, blog, checkout, or signup.
3. Infer the site's purpose, audience, and primary conversion goal.
4. Identify what is working well before listing problems.
5. Separate factual observations from inferences.
6. Do not invent metrics you cannot verify.
7. If something cannot be confirmed directly, label it as "likely" or "unclear".

## What to look for

### 1) First impression
Check:
- Is it immediately clear what the company/product does?
- Is the target audience obvious?
- Is the primary action obvious within a few seconds?
- Does the site feel trustworthy and current?

### 2) Visual design
Check:
- Clear hierarchy in headings, subheads, and CTA emphasis
- Readability, spacing, contrast, consistency
- Overcrowding, weak alignment, poor section rhythm
- Whether the design feels premium, generic, outdated, or confusing

### 3) Navigation and structure
Check:
- Is the top navigation understandable?
- Are pages grouped logically?
- Can a new visitor predict where to click next?
- Are there missing pages or dead-end journeys?

### 4) Copy and conversion
Check:
- Clear value proposition
- Specificity vs vague marketing language
- CTA quality and placement
- Objection handling, FAQs, proof, benefits, differentiation

### 5) Mobile and responsiveness clues
Check for:
- Overly dense sections
- Large tables, wide navs, tiny text, or layouts likely to break on mobile
- Sticky elements that may obstruct content
- CTA placement for mobile users

### 6) Accessibility basics
Check:
- Heading structure if visible
- Alt-text clues if available
- Contrast risks
- Tiny text, ambiguous buttons/links
- Overreliance on color alone
- Forms with weak labeling or error affordances

### 7) Trust and credibility
Check:
- Testimonials, reviews, client logos, case studies
- Team/about/contact transparency
- Policies, terms, privacy, refund info if relevant
- HTTPS, professional copy, consistency, signs of legitimacy

### 8) SEO signals
Check:
- Title/meta description quality if visible
- Heading clarity
- Indexable content vs image-heavy vagueness
- Internal linking
- Local SEO or topical relevance cues
- Structured content that matches search intent

### 9) Technical quality signals
Check:
- Broken images, obvious console/page errors if visible
- Slow-feeling or bloated sections
- Missing favicon, bad social preview hints, weak loading states
- Framework/CMS clues if visible
- Popup overload, cookie banner friction, intrusive widgets

## Output format

Use this structure:

### Summary
2-4 sentences on overall quality, likely goal, and biggest opportunities.

### What’s working
- 3 to 7 bullets

### Issues found
Group by severity:
- Critical
- Important
- Minor

### Category scores
Score each from 1-10 with a one-line reason:
- Clarity
- Design
- Navigation
- Conversion
- Accessibility
- Trust
- SEO
- Technical quality

### Top 5 fixes
List the five highest-impact improvements in priority order.
Each fix must include:
- What to change
- Why it matters
- Expected impact

### Quick wins
List changes that could likely be made in under one day.

## Scoring guidance

Use these ranges:
- 9-10: Excellent, very few meaningful issues
- 7-8: Strong, but notable improvements available
- 5-6: Average, several important weaknesses
- 3-4: Weak, likely hurting outcomes
- 1-2: Severely flawed

Be conservative. Avoid inflated scores.

## Style rules

- Be direct and specific.
- Prefer concrete examples over generic advice.
- Distinguish observed facts from assumptions.
- Do not shame the site owner.
- Optimize for actionable recommendations, not just critique.

## Special cases

If the site appears unfinished, broken, behind auth, or inaccessible:
- Say what you could and could not inspect
- Provide a partial audit from the visible pages
- Recommend the next best pages or artifacts to review

If the user gives a niche goal, prioritize it:
- SaaS: onboarding, pricing, product clarity, trust
- E-commerce: merchandising, PDP, cart, checkout friction
- Agency/local business: credibility, lead capture, differentiation, local trust
- Content site: readability, structure, internal linking, search intent
