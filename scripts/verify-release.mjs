import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { test } from 'node:test';
const name = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
).name;
const script = fileURLToPath(
  new URL('./check-npm-release.mjs', import.meta.url),
);
async function gate({
  status = 404,
  wrongIdentity = false,
  wrongContext = false,
  requestedTag = 'v1.2.3',
  privatePackage = false,
  tagBehind = false,
} = {}) {
  const cwd = await mkdtemp(join(tmpdir(), 'npm-release-gate-'));
  try {
    await writeFile(
      join(cwd, 'package.json'),
      JSON.stringify({ name, version: '1.2.3', private: privatePackage }),
    );
    const git = (...args) =>
      execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
    git('init', '--quiet');
    git('add', 'package.json');
    git(
      '-c',
      'user.name=Release Test',
      '-c',
      'user.email=release-test@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'fixture',
    );
    git('tag', 'v1.2.3');
    if (tagBehind) {
      await writeFile(join(cwd, 'new-source'), 'new');
      git('add', 'new-source');
      git(
        '-c',
        'user.name=Release Test',
        '-c',
        'user.email=release-test@example.invalid',
        'commit',
        '--quiet',
        '-m',
        'new source',
      );
    }
    const sha = git('rev-parse', 'HEAD');
    const output = join(cwd, 'output');
    await writeFile(
      join(cwd, 'fetch.mjs'),
      'globalThis.fetch = async () => new Response(' +
        JSON.stringify(
          JSON.stringify({
            name: wrongIdentity ? '@test/wrong' : name,
            version: '1.2.3',
          }),
        ) +
        ', {status: ' +
        status +
        '});',
    );
    const result = spawnSync(
      process.execPath,
      ['--import', join(cwd, 'fetch.mjs'), script],
      {
        cwd,
        env: {
          ...process.env,
          EXPECTED_PACKAGE: name,
          REQUESTED_TAG: requestedTag,
          GITHUB_SHA: wrongContext ? '0'.repeat(40) : sha,
          GITHUB_OUTPUT: output,
        },
        encoding: 'utf8',
        timeout: 10000,
      },
    );
    return {
      code: result.status,
      stderr: result.stderr,
      output: await readFile(output, 'utf8').catch(() => ''),
    };
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}
test('only a confirmed missing version requests publication', async () => {
  const r = await gate();
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.output, 'publish=true\n');
});
test('an existing exact version skips publication', async () => {
  const r = await gate({ status: 200 });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.output, 'publish=false\n');
});
test('registry failures are not mistaken for unpublished versions', async () => {
  const r = await gate({ status: 503 });
  assert.notEqual(r.code, 0);
  assert.equal(r.output, '');
});
test('an unexpected registry identity is rejected', async () => {
  const r = await gate({ status: 200, wrongIdentity: true });
  assert.notEqual(r.code, 0);
  assert.equal(r.output, '');
});
test('a mismatched workflow SHA cannot attest a different checkout', async () => {
  const r = await gate({ wrongContext: true });
  assert.notEqual(r.code, 0);
  assert.equal(r.output, '');
});
test('a mismatched tag cannot publish another package version', async () => {
  const r = await gate({ requestedTag: 'v1.2.4' });
  assert.notEqual(r.code, 0);
  assert.equal(r.output, '');
});

test('private generated apps cannot be published by the template workflow', async () => {
  const r = await gate({ privatePackage: true });
  assert.notEqual(r.code, 0);
  assert.equal(r.output, '');
});
test('a tag at another commit is rejected even when the workflow matches HEAD', async () => {
  const r = await gate({ tagBehind: true });
  assert.notEqual(r.code, 0);
  assert.equal(r.output, '');
});
