import { z } from 'astro/zod';
import { disclosureErrors } from '../../scripts/policy.mjs';

export const identifier = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
export const stageSchema = z.enum(['preparation', 'frozen', 'executing', 'complete']);
const publicBasis = z.string().min(1).refine(value =>
  /^(?:docs\/[A-Za-z0-9_./-]+\.md(?:#[a-z0-9-]+)?)$/.test(value) &&
  !value.split('/').includes('..') && disclosureErrors(value, 'basis').length === 0,
  'Basis must resolve to a public repository document');

export const claimSchema = z.object({
  claim_id: identifier,
  statement: z.string().min(1).refine(s => s.trim() === s && disclosureErrors(s, 'statement').length === 0),
  category: z.enum(['brand', 'principle', 'mission', 'contact', 'status', 'methodology', 'changelog', 'other']),
  basis: publicBasis,
  approval_state: z.enum(['pending', 'approved', 'rejected']),
  lifecycle_state: z.enum(['draft', 'review', 'approved', 'retired']),
  review_date: z.iso.date().nullable(),
  approval_record: z.enum(['founder_attestation', 'transcription', 'none']),
  status_stage: stageSchema.optional(),
}).strict().superRefine((claim, ctx) => {
  if (claim.approval_state === 'approved' && (claim.lifecycle_state !== 'approved' || claim.review_date === null || claim.approval_record === 'none')) {
    ctx.addIssue({ code: 'custom', message: 'Approved claims require approved lifecycle, review date, basis and approval record' });
  }
  if (claim.approval_state !== 'approved' && claim.review_date !== null) ctx.addIssue({ code: 'custom', message: 'Unapproved review_date must be null' });
  if ((claim.category === 'status') !== (claim.status_stage !== undefined)) ctx.addIssue({ code: 'custom', message: 'Only status claims require a bound lifecycle stage' });
  if (claim.approval_record === 'founder_attestation' && claim.approval_state !== 'approved') ctx.addIssue({ code: 'custom', message: 'Founder attestation requires founder approval' });
});

export const claimsSchema = z.array(claimSchema).superRefine((claims, ctx) => {
  const seen = new Set();
  for (const claim of claims) {
    if (seen.has(claim.claim_id)) ctx.addIssue({ code: 'custom', message: `Duplicate claim_id: ${claim.claim_id}` });
    seen.add(claim.claim_id);
  }
});

export function eligibleClaim(claim, id) {
  if (!claim) throw new Error(`Claim gate: unknown claim ${id}`);
  const parsed = claimSchema.parse(claim);
  if (parsed.claim_id !== id || parsed.approval_state !== 'approved' || parsed.lifecycle_state !== 'approved') throw new Error(`Claim gate: ineligible claim ${id}`);
  return parsed;
}

export const statusSchema = claims => z.object({
  entry_id: identifier,
  stage: stageSchema,
  claim_id: identifier,
}).strict().superRefine((entry, ctx) => {
  const claim = claims.find(c => c.claim_id === entry.claim_id);
  if (!claim || claim.category !== 'status' || claim.status_stage !== entry.stage || claim.approval_state !== 'approved' || claim.lifecycle_state !== 'approved' || claim.approval_record !== 'founder_attestation') {
    ctx.addIssue({ code: 'custom', message: 'Status stage requires a matching current founder-attested status claim' });
  }
});

export const referenceSchema = claims => z.object({
  entry_id: identifier,
  claim_ids: z.array(identifier).min(1),
}).strict().superRefine((entry, ctx) => {
  for (const id of entry.claim_ids) {
    const claim = claims.find(c => c.claim_id === id);
    if (!claim || claim.lifecycle_state === 'retired') ctx.addIssue({ code: 'custom', message: `Invalid or retired claim reference: ${id}` });
  }
});
