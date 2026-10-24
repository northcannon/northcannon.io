import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { evaluateNodeRuntime, formatResult } from '../scripts/check-node-runtime.mjs';

test('node runtime guard rejects vulnerable, unsupported and malformed versions', () => {
  for (const version of ['22.23.3', '24.22.0', '26.12.0', '20.19.5', '25.0.0', '23.11.0', '22.3.0']) {
    assert.equal(evaluateNodeRuntime(version).exit, 1, version);
  }
  for (const version of ['', 'v22', 'v22.23.4-rc.1', '22.23.04x', undefined]) {
    assert.equal(evaluateNodeRuntime(version).exit, 2, String(version));
  }
});

test('node runtime guard accepts patched versions with numeric comparison', () => {
  for (const version of ['22.23.4', '24.22.1', '26.12.1', '22.24.0', 'v24.22.1', '22.100.0']) {
    assert.equal(evaluateNodeRuntime(version).exit, 0, version);
  }
});

test('node runtime guard prints one line without environment data', () => {
  const line = formatResult(evaluateNodeRuntime('22.23.3'));
  assert.equal(line, 'node-runtime observed=22.23.3 floor=22.23.4 expected=none result=FAIL reason=below-floor');
  const run = spawnSync(process.execPath, ['scripts/check-node-runtime.mjs'], { encoding: 'utf8' });
  assert.match(run.stdout, /^node-runtime observed=\d+\.\d+\.\d+ floor=\S+ expected=none result=(PASS|FAIL) reason=\S+\n$/);
  assert.equal(run.status, evaluateNodeRuntime(process.versions.node).exit);
});
