# Redesign validation mapping

Founder approval 010 promotes the redesign to production. Production and draft-banner review output are tested separately.

- Old dropdown, indented mobile navigation and grouped active-state tests are replaced by flat six-item navigation, seven-item fit, keyboard-only native disclosure, exact active state and alias tests in `redesign.spec.mjs`.
- Superseded Phase 0.5 composition tests are replaced by production redesign, consolidated About, labelled synthetic panels and permanent migration redirect checks. Review composition assertions cover evidence classes, research independence, planned knowledge obligations and the Factory boundary.
- Historical media container and transcript mutation checks remain. Output policy now rejects the withdrawn recording even though its historical claims remain attested.
- Full review routes use the same rendered-text checks as production, with only declared pending claims admitted. The isolated primitive specimen has a separate narrow interface inventory and cannot be used as a production build.
- Every route in both builds is checked with axe tags `wcag2a`, `wcag2aa`, `wcag21aa`, no page JavaScript, local resources and headers. The complete viewport matrix is 390, 768, 1024, 1180, 1280, 1440 and 1920; reflow includes 200% text and keyboard menu operation.
- Native details is toggled with Enter/Space. Escape-to-close and focus trapping require browser JavaScript and are not part of this static disclosure.
- Rendering-parity updates are implementation regression baselines authorized for this redesign, not founder visual approval or independent acceptance.
- Host-specific redirect-fragment verification remains held until a founder-authorized preview. Local 301, fragment, one-hop and cached-alias behavior is tested.

## Production release validation — 11 October 2026

The completion session reviewed the inherited production cutover against founder
approval 010 and the architect remediation recorded at `a123e474`. Existing
approval events 001–009 are unchanged; event 010 attests 535 claims.
The founder explicitly authorized finishing validation and production publication.

The final test correction checks the approved status-page wording and its explicit
no-results disclosure. The hero wrapping assertion allows three lines, or four
at the 1024px two-column breakpoint. Neither correction changes approved copy.

`npm run check` passed: source/content validation, lint, typecheck, unit and
governance tests, production/review builds, browser checks and all 32 rendering
baselines. `npm audit --audit-level=low` reported zero vulnerabilities.
Browser skips are the declared single-project matrix/composition exclusions.

Release uses pull request 18 and the existing Cloudflare Pages Git integration.
Only the production `dist/` build is eligible for publication. Hosted redirect
fragments, security headers and artifact hashes are checked before merge.
The pre-release main commit is `a5f22ebb633130a51f1dab0eab04f5053eeddea1`;
if hosted checks fail, hold the merge. A post-release defect requires a reviewed
fix-forward change or restoration of the prior Cloudflare deployment.
