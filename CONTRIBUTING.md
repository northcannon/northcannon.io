# Contributing

## Boundary

This repository is a controlled public trust surface. It must remain isolated from NorthCannon's private monorepo — do not copy private repository contents into it, and do not create shortcuts (submodules, symlinks, private npm deps, etc.) back to private repositories.

**Allowed:**

- Website frontend
- Public documentation
- Approved marketing content
- Public research summaries
- Public claim registry
- Trust center content
- Public status reporting
- Approved metrics

**Forbidden:**

- Proprietary source code
- Experiment infrastructure
- Private evaluation harnesses
- Internal architecture implementation
- Model routing logic
- Calibration values and thresholds
- Private evidence packets
- Customer information
- Internal research artifacts

## Public claims

Every public factual, brand, principle, mission, contact or status statement belongs
in [`public_claims/claims.json`](public_claims/claims.json), the single registry
loaded by Astro's `claims` collection. Active and retired IDs remain unique.
Only the founder approves claims; an approved claim requires an approved lifecycle,
a review date, a resolvable public basis and an approval record.

Render factual text through the build-time `claim(id)` accessor. Pending, rejected,
retired or unknown IDs throw; the build also rejects unregistered text and known
ineligible statements in HTML. Interface/error labels and the isolated review
specimen have narrow explicit label inventories, not a general copy exemption.
All other collections reference claims rather than duplicating their statements.

Founder attestations must exactly match [the attestation record](docs/FOUNDER_APPROVALS.md).
The check now blocks every approved claim lacking its pinned founder attestation.
`src/content/routes.json` controls publication: each published route requires
approved pinned claims and approved interface labels; production links may not
target unpublished routes. Review builds permit pending drafts only outside
dist. A route's `claim_ids` are required; its `review_claim_ids` are optional copy slots that
render in review builds and reach production only once founder-attested, so an approval
event completes a page without code changes. Only the founder may authorize new pinned
approval events or route promotion.

## Workflow

Work happens on a feature branch with a pull request into `main` — no direct pushes to `main`, including via any admin bypass. Before merging:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

For the Astro foundation, run the complete `npm run check` and `npm audit`.
Historical content is not automatically eligible for rendering; only approved
current copy may be used. Never publish the repository root: the static build
output is `dist/`.

## Review

Implementation and review are separate roles. The person or agent implementing a change does not have unilateral acceptance authority over it — a second, independent review is expected before anything here is treated as published/authoritative, matching how the rest of NorthCannon's engineering works.

Any change to `src/governance/approval-events.mjs` is an approval event requiring
founder confirmation at pull-request review. Only a verbatim transcription of the
founder's own words may create one. Pins catch coordinated registry/record edits,
but a coordinated edit to the registry, record and pins still requires human
review.
