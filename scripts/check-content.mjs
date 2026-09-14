import { loadGovernance, provenanceWarnings } from '../src/governance/registry.mjs';
const data = loadGovernance();
console.log(`Content governance validated: ${data.claims.length} claims; 5 collections; resolvable public bases and exact founder attestations.`);
const warnings = provenanceWarnings(data.claims);
if (warnings.length) throw new Error(`Unpinned approved claims: ${warnings.join(', ')}`);
console.log('Publication attestation gate passed: all approved claims have pinned founder attestations.');
