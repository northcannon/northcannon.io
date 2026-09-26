# Public site specification

This document transcribes the founder-supplied design inputs for the public site
into a reviewable, text-searchable specification. The images remain the normative
source; where this transcription and an image disagree, the image wins.

## Authoritative inputs

The three images are local reference copies kept out of Git by `.gitignore`
(founder decision). Their identity is pinned here so any copy can be verified.

| Input | File name | SHA-256 |
| --- | --- | --- |
| Wireframes A (Home, Gate 1, Results) | `NorthCannon_Wireframes_A.PNG` | `d9d4fa3c34e662a6eb0038f2ee287475a382d714cddb3a769085ac0290206aa4` |
| Implementation brief | `NorthCannon_Public_Site_Implementation_Brief.PNG` | `4771249189c7181b571b5bd46a40f5154768dc1873edd304a553a5909ceb9c40` |
| Wireframes B (Evidence, About, Founder) | `NorthCannon_Wireframes_B.PNG` | `10b1f57c1aa345fd9456db1fcf4eb34e2481f21e52da9ffe45317bc17cb068e1` |

Authority when inputs conflict: founder instruction, the corrective directive,
Wireframes A, the implementation brief, Wireframes B, founder-approved claims,
repository governance, existing implementation, existing tests.

## Information architecture

Primary navigation, in order: Gate 1 (`/gate-1/`), Results (`/results/`), Evidence
(`/evidence/`), About (`/about/`) with a dropdown, Demo (`/demo/`), Contact (`/contact/`).
The wordmark links to the landing page (`/`). The About dropdown lists Company
(`/about/company/`), Features (`/about/features/`) and Founder (`/about/founder/`); it
opens on hover and keyboard focus with no JavaScript, the mobile menu (a `<details>`
element) indents the same links under About, and every About page carries a local
subnav (Overview, Company, Features, Founder) with `aria-current` on the active page.
`/about/company/`, `/about/features/` and `/about/founder/` are review-only until the
founder promotes them; production navigation lists only published, attested routes.
The former `/founder/` route is removed. Trust Center pages and the vision page are
supporting routes outside the primary navigation.

## Visual system ("instrument")

Inter and IBM Plex Mono are self-hosted (SIL OFL) in `public/fonts/`. Content sits in
purple-outlined modules with a header band and a CSS-counter module number; readouts
use a yellow mono key label over a large value; verdicts pair a beacon with a large
word; support cells are five hex checks that always carry a text label and glyph. The
palette tokens live in `src/styles/global.css`; every text pair keeps WCAG AA.

## Layout system (brief 04)

| Token | Value |
| --- | --- |
| Desktop breakpoint | ≥ 1024 px |
| Max width (desktop) | 1440 px |
| Grid | 12 columns |
| Outer margins | 72 px |
| Gutters | 24 px |
| Section spacing | 96 px |
| Card radius | 16 px |
| Sticky top navigation height | 80 px |
| Max text width | 760 px (hero copy ≈ 600 px, explanatory panels ≈ 720 px) |
| Mobile reference width | 390 px |
| Mobile side margins | 24 px |
| Mobile layout | one column, stacked cards |

## Design tokens (brief 05)

| Token | Value |
| --- | --- |
| Background | `#0B0F17` |
| Panel | `#131A26` |
| Elevated panel | `#182233` |
| Primary text | `#F5F7FB` |
| Secondary text | `#A7B1C2` |
| Border | `#2A3242` |
| Primary accent (violet) | `#8B5CF6` |
| Secondary accent (indigo) | `#6366F1` |
| Verified (green) | `#22C55E` |
| Pending (amber) | `#F59E0B` |
| Failed (red) | `#EF4444` |
| Hex pattern overlay | `#1B2333`, opacity 8–10% |

The corrective directive summarised two values as `#885CF6` and `#080F17`; the
brief reads `#8B5CF6` and `#0B0F17`, and the brief is authoritative.

## Semantic colour usage (brief 09)

- Green: verified — validated data, completed steps, confirmed state.
- Amber: pending or abstention — in progress, under review, explicitly abstained.
- Red: failed or not supported — failed validation, criteria not met, not supported.
- Violet: brand emphasis — key actions, active states, brand elements.

Status meaning is never conveyed by colour alone: every state also has an icon
shape and text.

## Navigation (brief 03)

- Desktop: mark and wordmark, then the seven primary links separated by thin rules,
  active link in violet with an underline.
- Mobile: mark and wordmark, a persistent Gate 1 status chip, and a hamburger menu.

## Component rules (brief 06)

- Experiment status banner: live experiment status, shown prominently.
- Lifecycle stepper: seven numbered stages — Defined, Frozen, Independent Review,
  Stress Test, Authorized, Executing, Results Published — current stage in violet.
- Comparison-arm tabs: segmented tabs, active tab filled violet.
- Evidence ledger card, hash block, contact CTA, last-updated timestamp.
- JSON status endpoint: shown in the brief; not implemented because the site serves
  static documents and no machine-readable status contract has been approved.

## Content and UX rules (brief 07)

Do not make demo claims. Use hello@northcannon.io for all inquiries. Keep the
build-in-public framing. Explain Gate 1 simply. Explain the evidence packet and
change intelligence. Support public scrutiny with links to sources and methods.
Do not overload pages with empty data tables.

## Implementation priorities (brief 08)

1. Gate 1 page (core experience)
2. Status surfaces (global and on relevant pages)
3. Reduce "Not supplied" clutter
4. Evidence page upgrades (ledger, provenance, hashes)
5. About page enhancement (mission, approach, credibility)
6. Founder motivation block (personal story and why now)
7. Visible desktop navigation (as specified)
8. Public methodology and version history

## Delivery notes (brief 10)

Desktop first with responsive mobile; maintain the visual identity; WCAG AA
contrast; semantic HTML; restrained, purposeful motion only; reuse components and
tokens; test across modern browsers; keep performance in mind.

## Page composition

### Home / Company (Wireframes A, 01)

1. Hero (≈ 560 px): evidence eyebrow, one-to-two-line headline, supporting text
   (≈ 600 px), primary "View Gate 1" and secondary "Explore Evidence" actions;
   right column shows a four-layer stack visual labelled Data, Evaluation, Evidence,
   Impact.
2. Core Capabilities: three equal-width cards (≈ 240 px) with icons — Verification,
   Provenance, Change Intelligence.
3. What NorthCannon is / is not: two columns, green affirmative list and red
   negative list, four concise bullets each.
4. Built to interoperate (≈ 220 px): Data Sources → NorthCannon Evaluation Layer
   (Adapters, Evaluation, Provenance, Evidence) → Outputs.
5. Get in touch: restrained bordered CTA with mail icon and "Contact Us" action.

### Gate 1 (Wireframes A, 02)

1. Status banner with state, experiment identity, last-updated time and share action.
2. Experiment Lifecycle: current status line and the seven-stage stepper.
3. What is Gate 1?: concise explanation (≈ 720 px).
4. Comparison Arms: four cards — Treatment, Baseline A, Baseline B, R+ — each with
   subtitle and Model / Config / Notes rows.
5. Falsification Criteria: warning panel with four numbered criteria.
6. Experiment Readiness Checklist: two columns of four items each.
7. Two link cards: View Results and Explore Evidence.

### Results (Wireframes A, 03)

1. Pre-execution banner (amber) with experiment identity and last-updated time.
2. Experiment Readiness: summary line and a five-step row (Definition, Datasets,
   Methods, Independent Review, Execution) with states.
3. Metrics that will be published: six compact metric cards in a 3 × 2 grid and a
   full-width operational-metadata card.
4. Comparison Arms: four segmented tabs above a results chart placeholder
   ("Results (coming soon)").
5. Explore Evidence link card.

### Evidence (Wireframes B, 04)

1. Hero: eyebrow, "From claims to verifiable evidence.", supporting text, document
   and shield illustration.
2. Evidence system status banner with last-updated time.
3. Three explanatory cards: What was frozen, What was executed, What supports the claim.
4. Evidence Ledger table: Date (UTC), Claim / Topic, Evidence Type, Artifact Hash,
   Status, link column; "Browse all evidence" link.
5. Artifact Hash (human readable) panel and Artifact Viewer panel side by side.
6. Last-updated strip with "See change log" link.

### Landing (`/`)

Principle eyebrow, motto headline, mission lede, three calls to action (View Gate 1,
Explore Evidence, About) and a decorative verification module. Company content moved
to `/about/company/`.

### About overview (`/about/`)

Founder's text first: eyebrow, headline, mission; then a NorthCannon module, a Why now
module, and three link modules to Company, Features and Founder.

### About / Company (`/about/company/`)

Core capabilities, what NorthCannon is and is not, built to interoperate, and Get in
touch (moved from the former landing page).

### About / Features (`/about/features/`)

Persistent disclosure line: "Illustrative · fictional data · designed behavior, not yet
implemented". Mock Change Intelligence (event strip, affected count, date readouts,
Proceed to Refuse verdicts, workload table), a downstream lineage graph for a fictional
institution, and Mock Evidence (five support cells and a static provenance drawer). No
scores, confidence meters, penalty or dollar figures, or Gate 1 language.

### About / Founder (`/about/founder/`)

Founder hero, why NorthCannon exists, selected background and credibility, currently
building, Get in touch, and two lower navigation cards.

### Demo (`/demo/`)

Founder direction, 2026-09-26: the recorded product demonstration is published here. It is a user-started
`<video controls>` (no autoplay, loop, or muted start; `preload="metadata"`), a poster frame, English captions
(`<track kind="captions">`), a disclosure line (fictional cases, pre-production, not legal advice, synthetic
narration), and a full transcript in a `<details>` element. There is no player script and no third-party host.
The change-propagation illustration stays below it.

- **Claims.** The title, lede, labels, disclosure, and the transcript (one claim per spoken paragraph, word for
  word) are pending claims (see [Public site copy](PUBLIC_SITE_COPY.md)). Until the founder attests all of them,
  production keeps the approved "Demo — Coming Soon" page and removes the video, captions, and poster from `dist/`.
  The founder's direction to publish the demonstration is the documented exception to brief 07's "Do not make demo
  claims"; every spoken statement is a founder-attested claim, not a free-standing one.
- **Security.** The header policy gains `media-src 'self'`. The markup and output checks allow exactly one video
  file, one captions file, and one poster (`scripts/policy.mjs`): the MP4 must carry no container metadata, the
  captions must be plain WebVTT whose words equal the transcript claims in order, and each file must fit
  Cloudflare Pages' 25 MiB limit.

## Copy governance

Wireframe text is checked string by string against `public_claims/claims.json` and
[Founder approvals](../FOUNDER_APPROVALS.md):

1. Where an approved claim carries the same content, it is used.
2. Where wireframe prose is illustrative and an approved claim fills the same role
   (headline, mission, principle, biography, vision), the approved claim is used.
3. Structural labels, headings, actions and descriptions without an approved claim
   are registered verbatim as pending claims — an approval block, not a deletion.
4. Illustrative state or data (dates, experiment IDs, hashes, "Frozen", "Complete",
   "Operational", counts) is never rendered as fact. A truthful empty state is
   registered as pending copy instead.

Production renders only founder-attested claims. The review build renders the full
composition with pending copy under the draft banner. Per-component status is in
[the fidelity matrix](WIREFRAME_FIDELITY_MATRIX.md).
