# Redesign validation mapping

The pending full-site review and retained production compositions are tested separately.

- Old dropdown, indented mobile navigation and grouped active-state tests are replaced by flat six-item navigation, seven-item fit, keyboard-only native disclosure, exact active state and alias tests in `redesign.spec.mjs`.
- Previous About, Features, Founder, Gate and Evidence composition checks continue against production while its Phase 0.5 content remains live. New review composition assertions cover consolidated About, evidence classes, research independence, planned knowledge obligations and the Factory boundary.
- Historical media container and transcript mutation checks remain. Output policy now rejects the withdrawn recording even though its historical claims remain attested.
- Full review routes use the same rendered-text checks as production, with only declared pending claims admitted. The isolated primitive specimen has a separate narrow interface inventory and cannot be used as a production build.
- Every route in both builds is checked with axe tags `wcag2a`, `wcag2aa`, `wcag21aa`, no page JavaScript, local resources and headers. The complete viewport matrix is 390, 768, 1024, 1180, 1280, 1440 and 1920; reflow includes 200% text and keyboard menu operation.
- Native details is toggled with Enter/Space. Escape-to-close and focus trapping require browser JavaScript and are not part of this static disclosure.
- Rendering-parity updates are implementation regression baselines authorized for this redesign, not founder visual approval or independent acceptance.
- Host-specific redirect-fragment verification remains held until a founder-authorized preview. Local 301, fragment, one-hop and cached-alias behavior is tested.
