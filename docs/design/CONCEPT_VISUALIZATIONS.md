# Concept visualizations — design review package

Review status: IMPLEMENTED DRAFT — pending independent review and founder approval. These are static conceptual website interfaces, not operational product functionality. No publication or product execution is authorized.

## Part 1 section 10 — coordinated visual direction

1. **Workspace:** a full-width Solutions console with exact identity, compact context, directed graph, selected consequence inspector, derived counts, coverage gaps, obligations and lifecycle.
2. **Exact transition authority:** three adjacent regions show proposal, evidence evaluation and withheld authority. A violet boundary emphasizes capability ≠ permission; the proposed version is separate from unchanged authorized state.
3. **Evidence and reconciliation:** a synthetic packet offers native artifact disclosures and full digests. The rehearsal receipt and observed state disagree; verification and reconciliation remain unresolved.
4. **Placement:** Home uses a compact three-part preview linking to Solutions; Solutions contains the only full console; Products keeps the layered stack and adds authority; Evidence separates the synthetic packet from its real ledger; Experiments refines research presentation; About stays editorial.
5. **Shared language:** existing dark panels, violet accents, semantic state borders, monospaced identities, Run 1 spacing and typography. Fragment selection and native disclosures provide deterministic exploration without browser JavaScript.
6. **Repetitions removed:** Home lineage illustration replaced by the scenario preview; Solutions standalone eight-stage grid and old worked example replaced by the console lifecycle. `redesign.json.retired_presentations` records this. Existing pending wording remains in the approval inventory for founder disposition. The knowledge-obligation table remains because it explains broader categories beyond this scenario.
7. **Product truth:** the concept label and PLANNED/ILLUSTRATIVE qualifier are adjacent to each interface. Unknown coverage never means unaffected. No product deployment, actual execution, customer, performance or completed acceptance is represented.
8. **Compositions:** 1440 desktop uses the existing site container with a central graph and narrower panels. Below 1280 panels become closed native disclosures around a horizontally scrollable graph. At phone widths, authority, evidence and comparison columns stack. See the capture references below; visual inspection status belongs to the implementation report.

## Part 2 section 14 A — Change Intelligence Console

Component hierarchy: ChangeConsole → ChangeHeader → ContextPanel / ConsequenceGraph / ConsequenceInspector → CoverageGap → RevalidationQueue → ChangeTimeline. The inspector renders one panel per node, selected with `:target` and `:has()`. A default SDK selection is visible without a fragment. The directed graph uses the six required state classes; dotted unknown-coverage borders differ from solid supported-unaffected borders. Admitted relationships are evidence-backed relationships only, not proof of compatible behavior.

The synthetic repository is `synthetic/harbor-fixture`. Its proposed lattice-fixture-sdk upgrade is 2.4.1 → 2.5.0. `src/content/concept-scenario.json` defines every node, relation, obligation, coverage gap and evidence record. SHA-256 values are deterministic hashes of labelled seed strings, never real evidence identities. Count claims are recomputed from the fixture in the governance tests.

Node fragments `#ci-node-<id>` select an inspector and highlight upstream/downstream paths. `#ci-mode-direct` dims transitive context; `#ci-mode-transitive` restores all relations; `#ci-mode-compare` swaps in StateComparison. These are mutually exclusive fragment states: selecting a node returns to graph mode. Evidence and full hashes use native details. Small-screen context and inspector disclosures are closed initially; keyboard users can open them and focus the graph scroll region. Hidden desktop/mobile panel variants have no duplicated IDs.

## Part 2 section 14 B — Exact Transition Authority

AuthorityBoundary has proposed state, evaluation and disposition columns. HashBlock identifies the exact candidate. Outstanding obligations and unknown coverage explain the withheld disposition. The proposal does not update authorized state. This remains a conceptual interface even where it illustrates principles of the implemented Phase A reference.

## Part 2 section 14 C — Evidence Packet

EvidencePacket identifies the synthetic candidate, configuration, repository and packet. Expandable records provide source descriptions, full synthetic digests and generation context. HashBlock reuses HashValue. ReconciliationLadder distinguishes intended version 2.5.0, rehearsal receipt 2.5.0, observed version 2.4.1, unresolved verification and non-reconciled acceptance. The receipt is explicitly a synthetic rehearsal, not an authorized transition. The packet's border and separation statement distinguish it from the published evidence ledger below it. Mobile evidence records stack and hashes wrap.

## Part 2 section 14 D — Website integration and captures

Capture directory: `.review-shots/run2/`. Planned capture names are `<page>-<width>.png`, for `home`, `solutions`, `products`, `evidence`, `experiments` and widths 1440, 1280, 1024, 768, 390, 375. Console state captures are `console-<state>-<width>.png`, states `sdk`, `config`, `compare`, widths 1440 and 390. Readable crops are under `crops/`. These references describe the delivery layout; the implementation report records exactly which files were created and opened.

Desktop composition references: `home-1440.png`, `solutions-1440.png`, `products-1440.png`, `evidence-1440.png`, `experiments-1440.png`. Mobile references use the same names at 390 and 375. Comparison and unknown-coverage views have their own console captures. No new visualization appears on About.

## Part 2 section 14 E — Design-system reconciliation and provenance

- **Wireframes A:** structured desktop grid, clear primary/supporting hierarchy and deliberate page rhythm. Historical navigation, Gate 1 status and old positioning were not carried into the concepts.
- **Wireframes B:** the mock console's blast-radius summary, action items, re-evaluation queue and timeline became derived counts, obligations, revalidation and lifecycle. The mock packet's decision, evidence, provenance and artifact hash became synthetic packet disclosures and a mismatch-preserving reconciliation ladder. Historical illustrative metrics and public-policy examples were not reused.
- **Implementation brief:** technical panels, monospaced annotations, violet brand emphasis, semantic state treatments, hash inspection and responsive grids. Current `global.css` and Run 1 `redesign.css` tokens take precedence over historic palette or layout values.
- **New for the pivot:** explicit consequence uncertainty, exact candidate authority, before/proposed comparison, unknown coverage versus supported-unaffected scope, withheld authorization and distinct receipt/observation/reconciliation states.

Diagram source references and review status are recorded in `concept-source-manifest.json`. Source of scenario meaning: `src/content/concept-scenario.json` and its E-014 pending claims in `POST_PIVOT_COPY.md`. Historical PNGs supply visual lineage only. Neither diagrams nor this package are architecture authority.

## Part 2 section 14 F — Complete illustrative content register

All elements below are pending E-014 claims. Every interface is qualified by `concept-truth` (Concept visualization — synthetic engineering scenario) and `concept-planned` or `concept-illustrative`. Node state, relationship, evidence, count, lifecycle, proposal, outcome and identity claims are illustrative fixture content. Interface labels and instructions are editorial A; any depiction of intended capability, lifecycle or authority behavior is founder-review B. Existing approved claims, approval events and package files are preserved.

| Claim ID | Illustrative text / interface element | Qualification |
| --- | --- | --- |
| `concept-truth` | Concept visualization — synthetic engineering scenario | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-planned` | PLANNED | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-illustrative` | ILLUSTRATIVE | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-console` | Change Intelligence Console | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-context` | Change context | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-graph` | Dependency and consequence graph | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-inspector` | Consequence inspector | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-queue` | Revalidation queue | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-timeline` | Illustrative change lifecycle | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-obligations` | Review obligations | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-coverage` | Coverage and uncertainty | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-evidence` | Synthetic evidence records | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-provenance` | Inspect synthetic provenance | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-hash` | Inspect full synthetic SHA-256 | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-direct` | Direct consequences | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-transitive` | Transitive consequences | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-compare` | Before / proposed | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-graph-mode` | Graph view | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-before` | Before the proposal | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-after` | After / proposed | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-preview-link` | Explore the synthetic change in Solutions | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-graph-access` | Synthetic dependency graph; scroll to explore and select an artifact | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-authority` | Exact Transition Authority | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-boundary` | Capability ≠ permission | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-proposal` | Proposed transition | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-evaluation` | Authority evaluation | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-decision` | Illustrative disposition | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-withheld` | Withheld pending evidence | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-authorized` | Authorized state remains unchanged | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-packet` | Synthetic Evidence Packet | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-reconciliation` | Reconciliation ladder | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-packet-separation` | Illustrative records below are separate from the published evidence ledger. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-seed-note` | All digests are synthetic SHA-256 values derived from labelled fixture seeds. They identify no real repository or evidence. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-repo` | Repository identity | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-candidate` | Exact candidate | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-configuration` | Configuration identity | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-scope` | Requested scope | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-source` | Change source | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-previous` | Previous dependency | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-proposed` | Proposed dependency | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-reason` | Reason in scope | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-relation` | Relationship evidence | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-gap` | Discovery gap | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-unknown-note` | Incomplete discovery cannot support an unaffected conclusion. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-unaffected-note` | Supported unaffected only within the recorded isolated-build scope. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-acceptance` | Acceptance withheld; evidence and coverage obligations remain open. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-receipt-boundary` | The receipt belongs to a synthetic rehearsal, not an authorized transition. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-comparison-known` | Known change: the dependency and lock record differ. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-comparison-potential` | Potential consequences: services, tests, schema compatibility and engineering knowledge require review. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-comparison-gap` | Evidence gap: dynamic configuration and recovery coverage remain unknown. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-before-knowledge` | Earlier architecture and recovery assumptions reference version 2.4.1. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-after-knowledge` | The proposed version requires reassessment of those assumptions. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-before-evidence` | Earlier synthetic test evidence applies to the old dependency only. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-after-evidence` | New compatibility evidence is missing; earlier results cannot authorize this candidate. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-qualification` | Qualification remains incomplete in this synthetic scenario. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-research-boundary` | Research evidence informs a proposal; separate review controls product adoption. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-state-changed` | CHANGED | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-state-potentially-affected` | POTENTIALLY AFFECTED | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-state-admitted` | ADMITTED | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-state-unresolved` | UNRESOLVED | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-state-unknown-coverage` | UNKNOWN COVERAGE | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-state-supported-unaffected` | SUPPORTED UNAFFECTED | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-node-sdk` | lattice-fixture-sdk | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-reason-sdk` | Dependency upgrade 2.4.1 → 2.5.0 is proposed; compatibility is not established. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-node-lock` | fixture.lock | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-reason-lock` | The lock record identifies the changed dependency bytes. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-node-engine` | Harbor fixture engine | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-reason-engine` | The engine imports the changed SDK; its integration behavior requires revalidation. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-node-api` | Harbor fixture API | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-reason-api` | The API consumes the changed SDK through an admitted import relationship. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-node-tests` | Compatibility test fixture | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-reason-tests` | The test dependency is admitted; a passing result for the proposed version is still missing. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-node-knowledge` | Architecture assumption fixture | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-reason-knowledge` | The engine behavior supports an architecture assertion that may now be stale. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-node-schema` | Envelope schema fixture | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-reason-schema` | A candidate API-to-schema relationship requires review before it can be admitted. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-node-config` | Dynamic configuration fixture | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-reason-config` | Dynamic loading is outside the discovered relationship scope; impact is unknown. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-node-recovery` | Recovery assumption fixture | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-reason-recovery` | Restoration compatibility has no relationship evidence for the proposed SDK. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-node-isolated` | Isolated render test fixture | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-reason-isolated` | A synthetic isolated-build record supports no dependency on the SDK within this test scope. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-edge-1` | pins | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-edge-2` | imports | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-edge-3` | imports | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-edge-4` | validated by | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-edge-5` | supports assumption | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-edge-6` | may consume | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-evidence-relationship-1` | Admitted synthetic relationship record: sdk → lock. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-hash-relationship-1` | ee7f0c86510bcb01fdc6e5e33740f266d624abb9231c196c2f65c145c4ccd562 | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-evidence-relationship-2` | Admitted synthetic relationship record: sdk → engine. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-hash-relationship-2` | f8a712f0d22a4f4907df05044db88977a3920174f5d47857d388cb90f7c7c448 | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-evidence-relationship-3` | Admitted synthetic relationship record: sdk → api. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-hash-relationship-3` | c081c280ee43196536ae5c1a51760a9ac40e949f4d85e686ea9b9f924d70904f | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-evidence-relationship-4` | Admitted synthetic relationship record: engine → tests. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-hash-relationship-4` | b5c346505986730d77e8f87354dbc248c2f8c737ee94e768e5031e7a1e907e8c | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-evidence-relationship-5` | Unadmitted synthetic relationship record: engine → knowledge. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-hash-relationship-5` | cb6295e633a26bd1cb987874ca9b88c5180b60f5024a0c883a639b3a5c00bcbd | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-evidence-relationship-6` | Unadmitted synthetic relationship record: api → schema. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-hash-relationship-6` | d69ee9b71ccfb3514790f56d895e9d3ea22e8eba6262aa9c48f1249e35e38779 | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-evidence-isolation` | Synthetic isolated-build record excludes SDK linkage only for the isolated render test. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-hash-isolation` | d917d1b4a69be8f9968aa9329189ac74dcf388aa722831cba8f5ae094af539a4 | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-evidence-candidate` | Synthetic candidate source and lock snapshot for the proposed upgrade. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-hash-candidate` | 5b1adb8df38975fd657f5c53ee471f26d5fb619698edd3d0c86581a9342f39ae | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-evidence-rehearsal` | Synthetic rehearsal receipt reports 2.5.0; the separate observation still records 2.4.1. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-hash-rehearsal` | 16059cefc8b1dfecaa12434108fa983c500fad1dbb19ed63928f15e73eeca3de | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-evidence-observation` | Synthetic observation disagrees with the intended dependency version; verification is unresolved. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-hash-observation` | 0c8b063875f816d8a59081f82c923027935ad10f420a3ab0feefd720a7d1b5ed | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-obligation-implementation` | Review the changed SDK integration before widening the execution scope. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-obligation-status-implementation` | Requires review | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-obligation-integration` | Revalidate compatibility tests against the exact proposed candidate. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-obligation-status-integration` | Awaiting evidence | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-obligation-architecture` | Reassess the architecture assertion derived from engine behavior. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-obligation-status-architecture` | Requires review | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-obligation-schema` | Establish the candidate schema relationship and examine compatibility. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-obligation-status-schema` | Requires review | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-obligation-history` | Determine whether earlier evidence applies to the proposed dependency bytes. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-obligation-status-history` | Awaiting evidence | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-obligation-recovery` | Resolve recovery and dynamic configuration coverage before authority can be granted. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-obligation-status-recovery` | Blocked by unknown coverage | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-gap-config` | Dynamic loading coverage is missing; the configuration cannot be classified unaffected. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-gap-recovery` | Recovery compatibility evidence is missing for the proposed version. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-lifecycle-1` | Change proposed | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-lifecycle-2` | Exact candidate identified | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-lifecycle-3` | Relationships evaluated within stated scope | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-lifecycle-4` | Potential consequences identified | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-lifecycle-5` | Review obligations derived | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-lifecycle-6` | Authority withheld pending evidence | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-lifecycle-7` | Execution not authorized | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-lifecycle-8` | Verification and reconciliation unresolved | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-identity-change` | SYN-CHANGE-014 | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-identity-repository` | synthetic/harbor-fixture | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-identity-candidate` | synthetic-revision-014 | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-identity-configuration` | synthetic-config-014 | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-identity-packet` | SYN-PACKET-014 | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-identity-previous` | lattice-fixture-sdk 2.4.1 | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-identity-proposed` | lattice-fixture-sdk 2.5.0 | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-identity-scope` | Proposed scope: dependency and lock record only; no service deployment. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-identity-source` | Synthetic dependency proposal and local rehearsal records. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-count-changed` | 2 directly changed artifacts | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-count-potential` | 3 potentially affected artifacts | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-count-services` | 2 impacted services | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-count-tests` | 1 relevant tests | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-count-knowledge` | 1 stale knowledge candidates | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-count-obligations` | 6 outstanding review obligations | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-count-unresolved` | 2 unresolved relationships | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-count-gaps` | 2 coverage gaps | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-ladder-1` | Intended | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-ladder-detail-1` | Proposed dependency version: 2.5.0. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-ladder-2` | Receipt | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-ladder-detail-2` | Synthetic rehearsal reports version 2.5.0. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-ladder-3` | Observed | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-ladder-detail-3` | Observed fixture version: 2.4.1 — mismatch. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-ladder-4` | Verified | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-ladder-detail-4` | Outcome verification remains unresolved. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-ladder-5` | Reconciled | `concept-truth`; PLANNED / ILLUSTRATIVE interface |
| `concept-ladder-detail-5` | Not reconciled; no accepted change is represented. | `concept-truth`; PLANNED / ILLUSTRATIVE interface |

## Part 2 section 14 G — Founder review

Open questions:

- Approve, revise or reject the E-014 synthetic scenario, visual semantics and pending copy?
- Is the withheld-authority example and separate rehearsal mismatch the preferred public explanation?
- Keep the direct/transitive fragment interaction and mobile disclosures?
- Accept the new console in place of the retired grid and Home lineage illustration?
- Confirm E-013 category/status-stage metadata separately; its request is not approval.
- Dispose of retained unused pending workflow copy in a later explicitly scoped inventory decision?

Independent review and founder acceptance remain separate. No claim is approved by a passing validator, screenshot or checkpoint commit.
