import process from 'node:process';
import assert from 'node:assert/strict';
import { readFile, appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(pkg.name, process.env.EXPECTED_PACKAGE);
assert.equal(pkg.private, false);
assert(/^\d+\.\d+\.\d+$/.test(pkg.version), 'Stable version required');
assert.equal(process.env.REQUESTED_TAG, 'v' + pkg.version);
assert.equal(
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  execFileSync('git', ['rev-parse', process.env.REQUESTED_TAG + '^{commit}'], {
    encoding: 'utf8',
  }).trim(),
);
assert.equal(
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  process.env.GITHUB_SHA,
  'Dispatch this workflow at the release tag to preserve provenance identity',
);
const response = await globalThis.fetch(
  'https://registry.npmjs.org/' +
    encodeURIComponent(pkg.name) +
    '/' +
    pkg.version,
);
assert(
  response.ok || response.status === 404,
  'Registry unavailable: ' + response.status,
);
if (response.ok) {
  const published = await response.json();
  assert.equal(published.name, pkg.name);
  assert.equal(published.version, pkg.version);
}
await appendFile(
  process.env.GITHUB_OUTPUT,
  'publish=' + (response.status === 404) + '\n',
);
