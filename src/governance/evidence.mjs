import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { z } from 'astro/zod';
export const evidenceClass = z.enum(['product', 'research', 'artifact', 'historical']);
export const evidenceRecord = z.object({
  evidence_class: evidenceClass, subject: z.string().min(1), status: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(), date: z.iso.date().optional(),
}).strict();
export const evidenceMetric = z.object({
  evidence_class: z.literal('product'), name: z.string().min(1), value: z.number(),
  denominator: z.number().positive(), scope: z.string().min(1), date: z.iso.date(),
  version: z.string().min(1), limitation: z.string().min(1), evidence: z.string().min(1),
}).strict();
export function validateEvidencePlacement(record, section) {
  evidenceRecord.parse(record);
  if (['triad', 'kpis'].includes(section) && record.evidence_class !== 'product') throw new Error('Product status and KPIs require product evidence');
  return record;
}

// The integration publishes an absolute project-root path on globalThis, so bundled and fixture builds never depend on the cwd.
export const productionProvenancePath = () => globalThis.northcannonProductionProvenance ?? 'dist/provenance.json';
export const productionManifestHash = () => createHash('sha256').update(readFileSync(productionProvenancePath())).digest('hex');
