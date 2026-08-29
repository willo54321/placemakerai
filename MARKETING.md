# Marketing Site — Competitive Research & Plan

Research date: 2026-08-29. Competitors: Go Vocal (govocal.com, formerly CitizenLab) and
Commonplace (commonplace.is).

> **Method caveat.** Direct access to `commonplace.is`, `govocal.com`, the Digital Marketplace
> listing and archive.org was blocked by the network proxy during this research. The teardown is
> reconstructed from search-index titles, URLs and snippets, plus Go Vocal's public source code.
> Structure, IA and messaging themes are reliable; exact hero wording, visual design and current
> page copy are **not verified**. Re-check with the live sites before making public comparison
> claims.

Full write-up (rendered): https://claude.ai/code/artifact/8d690998-0829-42b2-92f0-5e16d2a04cd3

---

## 1. Do competitors use their own CMS?

**Yes — both build their own content layer. Neither integrates a third-party CMS.**

**Go Vocal** — confirmed from source (github.com/CitizenLabDotCo/citizenlab, source-available):

- Backend: Ruby on Rails, multi-tenant via the Apartment gem, Rails engines per feature
  (`back/engines/free/`: `email_campaigns`, `frontend`, `polls`, `seo`, `surveys`,
  `user_confirmation`, `volunteering`), Docker + RabbitMQ.
- Frontend: React 16, separate `front/` app.
- CMS layer: **`@craftjs/core` ^0.2.0-beta.5** (Craft.js page builder) + **Quill 1.3.7** rich text
  + `react-jsonschema-form` / `@jsonforms/react` for schema-driven forms. Their support docs
  describe a drag-and-drop **Content Builder** for project descriptions and the homepage.

**Commonplace** — closed source, no public repo. Proprietary, bespoke; consultation pages are
configured in-platform. Acquired by Zencity in January 2025; map features and subscriber
management being folded into Zencity.

**Why they need one and we don't:** both are *destination platforms* — they host the client's
entire consultation site, so a page builder is mandatory. Placemaker is embed-first: the client's
own website is the CMS. See the embed-first note in `CLAUDE.md`.

**Decision: do not build a page builder.** Content authored in Placemaker belongs in structured,
themeable project fields (`introHeading`, `introBody` markdown, `heroImageUrl`), not a freeform
canvas. Revisit only if we ever sell a hosted standalone consultation page.

---

## 2. Competitor marketing sites

### Go Vocal — govocal.com

| | |
|---|---|
| Model | Destination platform; whole consultation site hosted on their domain |
| Scale claim | 600+ governments; practitioner network of 600+ used as a retention moat |
| Pitch | Breadth of method (surveys, voting, mapping, budgeting, offline); "sustained culture of engagement" over one-off projects |
| Pricing | **Published.** Seat-based tiers — admin seats, project-manager seats, feature gates |
| Unusual | Public `/open-source` page; source-available code as a procurement trust signal |

IA: `/platform-online-engagement-toolbox`, `/go-vocal-for/{persona}`, `/our-impact`, `/plans`,
`/faq`, `/open-source`, `/global` + localised domains, `support.govocal.com`,
`developers.govocal.com`.

### Commonplace — commonplace.is

| | |
|---|---|
| Model | Destination platform, narrowed to UK planning and placemaking |
| Scale claim | 10M+ community members, 3,500+ projects, 200+ organisations. Names: Mayor of London, Leeds, Westminster, Grosvenor, Landsec |
| Pitch | Volume of response — "up to 10× more responses than traditional methods"; mobile-first sentiment heatmap; AI insights dashboard |
| Pricing | **Hidden.** Not on site; G-Cloud listing shows £2,250 – £50,000 per licence |
| Unusual | Ships feature announcements as public `/product-roadmap/` posts — content engine as changelog |
| Status | **Acquired by Zencity, January 2025** |

IA: `/citizen-engagement-platform`, `/platform/{product}` (e.g. PlanApps), `/solutions/{sector}`,
`/developers`, `/customer-stories` + tags, `/blog` + topic + author + pagination,
`/product-roadmap/{post}`, per-use-case demo landing pages, G-Cloud listing.

### The shared template

`Category claim → logo wall → scale stats → method grid → persona/sector pages → customer stories
→ blog → book a demo`

Everything on both sites describes software you cannot touch until a salesperson shows it to you.

---

## 3. Openings

1. **Neither demonstrates.** Both sell screenshots behind a demo form. No working map on any
   homepage in the category.
2. **The bottom of the market is unpriced.** Commonplace starts ~£2,250 and hides it; Go Vocal is
   seat-based enterprise. Parish councils, single developments and small consultancies have
   nowhere to land.
3. **Acquisition uncertainty.** Commonplace's UK customers are watching a British planning tool get
   absorbed into a US civic-analytics company. "Nothing to migrate" lands hard right now.
4. **Destination lock-in — the structural one.** Both force projects into their page templates and
   design system. They cannot copy the embed model without abandoning their business. This is the
   only gap that is defensible rather than temporary.
5. **AI is claimed, not shown.** Both say "AI-powered dashboard" and stop.

---

## 4. Messaging

Current holding-page headline ("Better public consultation for planning projects") is generic —
both competitors could run it unchanged. Launch headline candidates:

- **"Consultation that runs on your website, not ours"** — leads with the structural difference
- "Your consultation site. Your brand. Our engine."
- "Keep your website. Add the consultation." — speaks to the migration objection

**Say:**
- Embeds into the site you already have — no new domain, no migration, no retraining residents
- Inherits your colours and typography; pages look like your organisation, not a vendor
- AI analysis across map pins, form responses and enquiries in one pass
- Live in ten minutes: create a project, paste one line
- Pricing on the page

**Don't say:**
- Any scale statistic we cannot substantiate — this sector is small and it checks
- Named competitors in body copy; let "no lock-in" / "nothing to migrate" do it implicitly
- "AI-powered" without a visible output beside it
- "Design system" as customer-facing language — internal framing. Customers hear "it looks like
  your website"

---

## 5. Hero concept — scripted sequence, then live embed

Modelled on Stripe's marketing pattern: product demos as **real DOM animation, not video** —
crisp at any resolution, small payload, accessible, theme-aware, no play button. Sequenced
auto-play triggered on scroll-into-view, settling into a legible resting frame, becoming
interactive only once touched.

**Stripe fakes their demo because they must** (a payments dashboard is real money). We are not
constrained that way — but a raw live embed as the hero has four problems: empty-state death (a
map with three pins looks abandoned), heavy above-the-fold payload (Leaflet + tiles hurts LCP),
moderation risk (unmoderated public pins on the homepage), and no narrative (a live map doesn't
tell the visitor what to look at).

**Hybrid: real product code, scripted data.** Render the actual map component
(`InteractiveMap.tsx`, `SentimentHeatmap.tsx`, `leaflet.heat` — all already in the repo) with a
synthetic pin dataset, driven through a timeline:

1. Map settles on a site boundary (existing GeoJSON layer rendering)
2. Pins land one at a time, ~180ms stagger, in sentiment colours — the money moment; a
   consultation in fast-forward
3. Response counter ticks up
4. Heatmap blooms underneath
5. Analysis panel fades in — themes, sentiment split, pull-quote. **Staggered fade, not a
   typewriter effect** (typing animations read as AI slop)
6. Resting state: everything visible and readable

**Brand switcher** sits below: three preset buttons swapping `embedPrimaryColor` /
`embedFontFamily` / `embedHideStreetLabels` on `Project`, re-skinning the map live. Demonstrates
"no design system lock-in" as something the visitor does with their hands. Cheap — the styling
params already exist and work.

**The genuinely live embed goes further down, or on `/demo`** — progressive interactivity: scripted
story first, real product second.

Implementation: `IntersectionObserver` to start on view; `prefers-reduced-motion` renders the final
frame immediately; hover/touch pauses and hands over control. No Framer Motion — a small state
machine plus CSS transitions covers it.

Later, if the switcher earns attention: a field where visitors paste their own site URL and see the
embed rendered against it.

---

## 6. Information architecture — 6 pages at launch

| Path | Job | CTA |
|---|---|---|
| `/` | Hero sequence, brand switcher, three products, who it's for | Book a demo |
| `/how-it-works` | Create project → paste embed code → read analysis. Show the actual snippet | Start free |
| `/platform` | Three products in depth, anchored `#map` `#forms` `#analysis`. Split later if SEO warrants | Book a demo |
| `/pricing` | Published numbers — sharpest differentiator against a competitor who hides them | Start free |
| `/demo` | Real sandbox project anyone can pin, plus booking form | Book / try |
| `/privacy` | Exists. GDPR detail matters — public-sector procurement reads this properly | — |

Phase 2: `/for/{segment}` (local government, developers, consultancies), `/case-studies/{slug}`.
Phase 3: `/insights/{slug}`.

Copying Commonplace's content-operation IA while producing a tenth of the content reads as an
empty building.

### Homepage section stack

1. Live sequence hero
2. Brand switcher — "Same platform. Your brand, your site, your domain."
3. Three products, equal weight
4. How it works in three steps — show the actual `<iframe>` snippet
5. Real AI output — themes, sentiment split, representative quotes
6. Who it's for — three cards
7. Proof, honestly scaled — **we do not have 3,500 projects; do not imply we do.** Early on: a
   named pilot, a founder credential, or the demo project's own live response count
8. Pricing teaser → closing CTA. Two paths only

---

## 7. Build phases

**Phase 1 — launch**
- Marketing routes under `src/app/(marketing)/` in the existing Next app; same repo, same Tailwind
  theme, served on `placemakerai.io` via the existing middleware domain split
- Retire `/holding` once `/` ships
- Seed a public demo project; build the hero sequence and the three styling presets
- Six pages, real copy, no placeholder sections
- Replace the `@secnewgate.co.uk` contact address with one on `placemakerai.io` — a vendor whose
  contact email is at another company reads as a side project

**Phase 2 — after first customers**
- Segment pages, once each has a genuinely different argument
- First case study with defensible response numbers
- **G-Cloud / Digital Marketplace listing** — Commonplace is listed; a real procurement route into
  UK public sector, arguably higher return than content marketing
- Paste-your-URL preview, if the switcher proves it earns attention

**Phase 3 — only if resourced**
- Insights/blog — open only with a real publishing commitment; a stale blog is worse than none
- Help centre (cf. `support.govocal.com`)
- Public changelog (Commonplace's `/product-roadmap/` trick)

**Dogfood the positioning:** build the site in the Next app. Putting our own marketing site on
Webflow or HubSpot while telling councils they don't need a separate platform for their content is
a contradiction a sharp prospect will notice.

---

## 8. Open decisions

1. **Primary buyer** — councils, developers, or consultancies? Homepage can serve all three, but
   the hero headline and demo project should aim at one.
2. **Self-serve tier?** Decides whether the CTA is "Start free" or "Book a demo", and whether
   `/pricing` is a table or a positioning page. Biggest structural fork.
3. **What can we name?** Any pilot, live consultation, or quotable client. Proof placement depends
   on it, and pretending is not an option in a sector this small.
4. **Price point** — if meaningfully under Commonplace's ~£2,250 floor, publishing the number is
   our strongest single page.

---

## Sources

- Go Vocal: [/plans](https://www.govocal.com/plans),
  [/platform](https://www.govocal.com/platform-online-engagement-toolbox),
  [GitHub](https://github.com/CitizenLabDotCo/citizenlab),
  [OSS edition](https://github.com/CitizenLabDotCo/citizenlab-oss)
- Commonplace: [/citizen-engagement-platform](https://www.commonplace.is/citizen-engagement-platform),
  [G-Cloud listing](https://www.applytosupply.digitalmarketplace.service.gov.uk/g-cloud/services/309165893513448)
- [Zencity acquires Commonplace — Tech.eu](https://tech.eu/2025/01/22/zencity-acquires-planning-engagement-platform-commonplace/)
