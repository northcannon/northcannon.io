import { pathToFileURL } from 'node:url';

// Supported Node majors and their minimum patched releases (October 2026 security releases).
export const floors = { 22: [22, 23, 4], 24: [24, 22, 1], 26: [26, 12, 1] };

export function evaluateNodeRuntime(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(typeof version === 'string' ? version : '');
  if (!match) return { exit: 2, observed: 'unparseable', floor: 'none', reason: 'malformed-version' };
  const parts = match.slice(1).map(Number);
  const floor = floors[parts[0]];
  if (!floor) return { exit: 1, observed: parts.join('.'), floor: 'none', reason: 'unsupported-major' };
  const floorText = floor.join('.');
  for (let i = 0; i < 3; i += 1) {
    if (parts[i] !== floor[i]) {
      return parts[i] > floor[i]
        ? { exit: 0, observed: parts.join('.'), floor: floorText, reason: 'at-or-above-floor' }
        : { exit: 1, observed: parts.join('.'), floor: floorText, reason: 'below-floor' };
    }
  }
  return { exit: 0, observed: parts.join('.'), floor: floorText, reason: 'at-or-above-floor' };
}

export function formatResult(result) {
  return `node-runtime observed=${result.observed} floor=${result.floor} expected=none result=${result.exit === 0 ? 'PASS' : 'FAIL'} reason=${result.reason}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = evaluateNodeRuntime(process.versions.node);
  console.log(formatResult(result));
  process.exit(result.exit);
}
