# Wireframe fidelity matrix

> Historical implementation matrix transferred from the test branch. The pending
> labels and criteria notes below predate founder finalization and are not current
> approval state. See PUBLIC_SITE_COPY.md and FOUNDER_APPROVALS.md for current copy
> authority. Final manual visual reconciliation of this matrix remains outstanding;
> this file does not assert independent acceptance or publication readiness.

Status values: EXACT, RESPONSIVE ADAPTATION, CONTENT-APPROVAL BLOCKED, NOT APPLICABLE.
"Blocked" components are fully built and render in the review build; production omits
their pending copy until founder attestation (see [copy awaiting approval](PUBLIC_SITE_COPY.md)).

| Wireframe | Page | Component | Status | Implementation | Deviation |
| --- | --- | --- | --- | --- | --- |
| Brief 03 | All | Desktop header: mark, wordmark, seven links, active underline, 80px sticky | CONTENT-APPROVAL BLOCKED | `SiteHeader.astro` | Company, Gate 1, Founder, Contact labels pending; production shows attested links only |
| Brief 03 | All | Mobile header: persistent Gate 1 chip and hamburger | RESPONSIVE ADAPTATION | `SiteHeader.astro`, native `details` | Chip shows the governed state (Preparation, amber), not the illustrative "In Review" |
| A 01 | All | Footer: company, tagline, three links | EXACT | `SiteFooter.astro` | Approved principle replaces "Evidence provides trust."; Trust Center and Disclosure replace Privacy and Terms, which do not exist; no copyright year |
| Brief 05 | All | Hex / graphene background | EXACT | `scripts/generate-lattice.mjs` | Founder direction: lattice follows the landing reference and blends into the ground, replacing the 8–10% overlay token |
| Brief 05 | All | Panel and card colours | EXACT | `global.css` tokens | Founder direction: charcoal content boxes (#121216→#0d0d10, #2e2e3b border) replace #131A26 / #182233; filled actions use #7C3AED and violet text #A78BFA for WCAG AA |
| A 01 | Home | Hero: eyebrow, 2-line headline, text, two CTAs | CONTENT-APPROVAL BLOCKED | `HomePage.astro` | Approved principle, motto and mission replace illustrative hero copy; CTA labels pending |
| A 01 | Home | Four-layer visual: Data, Evaluation, Evidence, Impact | CONTENT-APPROVAL BLOCKED | CSS isometric stack | Data, Evaluation, Impact labels pending |
| A 01 | Home | Core Capabilities: three cards | CONTENT-APPROVAL BLOCKED | `.capability-grid` | Verbatim wireframe copy pending |
| A 01 | Home | What NorthCannon is / is not | CONTENT-APPROVAL BLOCKED | `.truth-grid` | Verbatim copy pending |
| A 01 | Home | Built to interoperate diagram | CONTENT-APPROVAL BLOCKED | `.interop` | Verbatim copy pending |
| A 01 | Home | Get in touch CTA | CONTENT-APPROVAL BLOCKED | `ContactCTA.astro` | Links to /contact/ |
| A 02 | Gate 1 | Status banner with ID, last updated, share | CONTENT-APPROVAL BLOCKED | `StatusBanner.astro` | Governed Preparation state (amber) replaces illustrative "Frozen"; ID shown empty; date is the status attestation date; Share is a permalink (no JavaScript) |
| A 02 | Gate 1 | Seven-stage lifecycle | CONTENT-APPROVAL BLOCKED | `.lifecycle`, stage from `collections.json` | Current stage derived from governed status |
| A 02 | Gate 1 | What is Gate 1? | CONTENT-APPROVAL BLOCKED | panel | Verbatim copy pending factual confirmation |
| A 02 | Gate 1 | Comparison arms: four cards | CONTENT-APPROVAL BLOCKED | `.arm-grid` | Model/Config/Notes values shown empty, not TBD/Standard |
| A 02 | Gate 1 | Falsification criteria | CONTENT-APPROVAL BLOCKED | `.criteria` | Criterion 2 contains an unresolved threshold placeholder |
| A 02 | Gate 1 | Readiness checklist | CONTENT-APPROVAL BLOCKED | `.checklist` | All items shown pending; no completion is public |
| A 02 | Gate 1 | Results / Evidence link cards | CONTENT-APPROVAL BLOCKED | `LinkCard.astro` | — |
| A 03 | Results | Pre-execution banner | EXACT | `StatusBanner.astro` | Adds approved status sentence; production shows it with "Results" heading |
| A 03 | Results | Experiment readiness row | CONTENT-APPROVAL BLOCKED | `.readiness` | Pending states replace illustrative Complete/Scheduled; amber icon replaces green check |
| A 03 | Results | Metrics that will be published (3 × 2) | CONTENT-APPROVAL BLOCKED | `.metric-grid` | Founder-approved metric labels replace illustrative metrics; descriptions await founder-supplied definitions |
| A 03 | Results | Operational metadata | CONTENT-APPROVAL BLOCKED | `.metadata-card` | Hosts the remaining eight approved labels |
| A 03 | Results | Comparison arm tabs and chart placeholder | CONTENT-APPROVAL BLOCKED | `:target` tabs | No chart values |
| A 03 | Results | Explore Evidence link | CONTENT-APPROVAL BLOCKED | `LinkCard.astro` | — |
| B 04 | Evidence | Hero and illustration | CONTENT-APPROVAL BLOCKED | `EvidencePage.astro` | Approved methodology statement replaces supporting sentence |
| B 04 | Evidence | Evidence status banner | CONTENT-APPROVAL BLOCKED | `StatusBanner.astro` | "Evidence will appear after execution" (amber) replaces "Operational" |
| B 04 | Evidence | Three explanatory cards | CONTENT-APPROVAL BLOCKED | `.explainer-grid` | — |
| B 04 | Evidence | Evidence ledger | CONTENT-APPROVAL BLOCKED | `.ledger` | Empty state; no fictional rows |
| B 04 | Evidence | Artifact hash and viewer | CONTENT-APPROVAL BLOCKED | `.artifact-grid` | No hash or artifact; copy icon omitted (needs JavaScript) |
| B 04 | Evidence | Last updated / change log strip | EXACT | `.updated-strip` | Date is the status attestation date |
| B 05 | About | Intro | CONTENT-APPROVAL BLOCKED | `AboutPage.astro` | Approved mission replaces public-policy supporting sentence |
| B 05 | About | Three cards | CONTENT-APPROVAL BLOCKED | `.about-cards` | Approved motto and biography sentence replace conflicting descriptions |
| B 05 | About | Mock evidence packet | CONTENT-APPROVAL BLOCKED | `.mock-panel` | No versions, scores or real-looking hashes |
| B 05 | About | Mock change intelligence console | CONTENT-APPROVAL BLOCKED | `.mock-panel` | Relative times replace calendar dates |
| B 05 | About | Mockup disclaimer bar | CONTENT-APPROVAL BLOCKED | `.disclaimer-bar` | — |
| B 06 | Founder | Founder hero | CONTENT-APPROVAL BLOCKED | `FounderPage.astro` | Biography sentence replaces "independent researcher" |
| B 06 | Founder | Why NorthCannon exists | EXACT | vision paragraphs 1–2 | Approved vision replaces public-policy copy; adds Vision link |
| B 06 | Founder | Selected background and credibility | CONTENT-APPROVAL BLOCKED | `.background-grid` | Approved biography; approved principles lead the credibility list |
| B 06 | Founder | Currently building | CONTENT-APPROVAL BLOCKED | vision paragraph 5 plus bullets | — |
| B 06 | Founder | Get in touch and lower link cards | CONTENT-APPROVAL BLOCKED | `ContactCTA.astro`, `LinkCard.astro` | — |
| Brief 03 | Contact | Contact destination | NOT APPLICABLE | `ContactPage.astro` | No wireframe; composed from the design system with approved contacts |
| Brief 06 | — | JSON status endpoint | NOT APPLICABLE | — | No approved machine-readable status contract |
| All | All | 390px layouts | RESPONSIVE ADAPTATION | ≤ 1024px rules | One column, 24px margins, stacked cards |

## Redesign addendum (About section and instrument visual system)

Supersedes the Home, About and Founder rows above where they differ. Status for all rows
below is CONTENT-APPROVAL BLOCKED: new copy is pending and rendering parity fixtures are
regenerated only after founder visual approval.

| Area | Page | Element | Implementation | Note |
| --- | --- | --- | --- | --- |
| Shell | All | Header: wordmark, Gate 1, Results, Evidence, About dropdown, Demo, Contact | `SiteHeader.astro` | JS-free dropdown and `<details>` mobile menu |
| Shell | All | Instrument modules, readouts, verdicts, support cells | `Module`, `Readout`, `Verdict`, `SupportCells` | Tokens in `global.css` |
| Home | `/` | Slim hero and decorative verification module | `HomePage.astro` | Replaces the four-layer stack; company sections moved |
| About | `/about/` | Overview: founder text, NorthCannon and Why now modules, subpage links | `AboutPage.astro` | Replaces the mock evidence packet and console |
| About | `/about/company/` | Capabilities, is / is not, interoperability, contact | `AboutCompanyPage.astro` | Moved from the landing page |
| About | `/about/features/` | Illustrative Change Intelligence, lineage and Evidence views | `AboutFeaturesPage.astro` | Fictional data; pending claims only |
| About | `/about/founder/` | Founder page | `FounderPage.astro` | Moved from `/founder/`; unpublished |
