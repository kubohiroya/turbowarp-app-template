import process from 'node:process';
import console from 'node:console';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = await mkdtemp(join(tmpdir(), 'turbowarp-template-package-'));
try {
  const [packed] = JSON.parse(
    execFileSync(
      'npm',
      ['pack', '--ignore-scripts', '--json', '--pack-destination', temp],
      {
        cwd: root,
        encoding: 'utf8',
      },
    ),
  );
  const files = new Set(packed.files.map((file) => file.path));
  for (const file of [
    'dist/init-app.js',
    'dist/readme.js',
    'dist/template.gitignore',
    'scripts/build-sb3.ts',
    'config/app.json',
  ])
    assert(files.has(file), `Missing packaged file: ${file}`);
  assert(
    ![...files].some(
      (file) => file.startsWith('public/downloads/') || file === '.npmrc',
    ),
  );
  const installed = join(
    temp,
    'consumer/node_modules/@kubohiroya/turbowarp-app-template',
  );
  await mkdir(installed, { recursive: true });
  execFileSync('tar', [
    '-xzf',
    join(temp, packed.filename),
    '--strip-components=1',
    '-C',
    installed,
  ]);
  const destination = join(temp, 'new-app');
  await mkdir(join(destination, '.git'), { recursive: true });
  await writeFile(join(destination, '.git/keep'), 'keep git metadata');
  const config = JSON.parse(
    await readFile(join(root, 'config/app.json'), 'utf8'),
  );
  config.slug = 'turbowarp-cli-package-app';
  config.title = 'Packaged CLI test';
  const configPath = join(temp, 'app-config.json');
  await writeFile(configPath, JSON.stringify(config));
  const installedMetadata = JSON.parse(
    await readFile(join(installed, 'package.json'), 'utf8'),
  );
  const entry = join(installed, installedMetadata.bin['create-turbowarp-app']);
  assert((await readFile(entry, 'utf8')).startsWith('#!/usr/bin/env node\n'));
  execFileSync(process.execPath, [entry, destination, configPath], {
    encoding: 'utf8',
  });
  const generated = JSON.parse(
    await readFile(join(destination, 'package.json'), 'utf8'),
  );
  assert.equal(generated.name, '@kubohiroya/' + config.slug);
  assert.equal(generated.private, true);
  assert.equal(generated.bin, undefined);
  assert.equal(generated.publishConfig, undefined);
  for (const script of ['prepack', 'pack:check', 'build:cli', 'test:release'])
    assert.equal(generated.scripts[script], undefined);
  await assert.rejects(
    readFile(join(destination, '.github/workflows/release.yml')),
  );
  await assert.rejects(
    readFile(join(destination, 'scripts/check-npm-release.mjs')),
  );
  assert.equal(
    await readFile(join(destination, '.git/keep'), 'utf8'),
    'keep git metadata',
  );
  assert.match(
    await readFile(join(destination, '.gitignore'), 'utf8'),
    /node_modules\//,
  );
  assert.match(
    await readFile(join(destination, 'README.md'), 'utf8'),
    /Packaged CLI test/,
  );
  const refused = spawnSync(
    process.execPath,
    [entry, destination, configPath],
    { encoding: 'utf8' },
  );
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /empty except for .git/);
  console.log(
    'Packaged JavaScript CLI ran from node_modules; generated app is private, preserves Git and refuses overwrites.',
  );
  console.log(
    JSON.stringify({
      package: packed.filename,
      integrity: packed.integrity,
      files: files.size,
    }),
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
