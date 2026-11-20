#!/usr/bin/env node
import { cp, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readmeEn, readmeJa, type AppConfig } from './readme.ts';

const [destinationArgument, configArgument] = process.argv.slice(2);
if (!destinationArgument || !configArgument)
  throw new Error(
    'Usage: pnpm template:init <existing-empty-directory> <app-config.json>',
  );
const template = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(destinationArgument);
const relationship = relative(template, destination);
if (
  !isAbsolute(relationship) &&
  relationship !== '..' &&
  !relationship.startsWith('..' + (process.platform === 'win32' ? '\\' : '/'))
)
  throw new Error('Destination must be outside the template.');
const contents = await readdir(destination);
if (contents.some((name) => name !== '.git'))
  throw new Error('Destination must be empty except for .git.');
const config = JSON.parse(
  await readFile(resolve(configArgument), 'utf8'),
) as AppConfig;
if (
  !/^turbowarp-[a-z0-9-]+-app$/.test(config.slug) ||
  typeof config.title !== 'string' ||
  !config.title.trim() ||
  typeof config.summary !== 'string' ||
  !Array.isArray(config.modes) ||
  !config.modes.length ||
  !Array.isArray(config.plannedFeatures) ||
  !Array.isArray(config.plannedDependencies)
)
  throw new Error('Invalid app configuration.');
const modes = new Set<string>();
for (const mode of config.modes) {
  if (
    typeof mode.id !== 'string' ||
    !mode.id ||
    modes.has(mode.id) ||
    typeof mode.label !== 'string' ||
    typeof mode.description !== 'string'
  )
    throw new Error('Invalid or duplicate mode.');
  modes.add(mode.id);
}
for (const item of [...config.plannedFeatures, ...config.plannedDependencies])
  if (typeof item !== 'string') throw new Error('Invalid plan entry.');
const translation = config.en;
if (translation !== undefined) {
  if (typeof translation !== 'object' || translation === null)
    throw new Error('Invalid English translation.');
  for (const item of [
    translation.summary,
    ...(translation.plannedFeatures ?? []),
    ...(translation.plannedDependencies ?? []),
  ])
    if (item !== undefined && typeof item !== 'string')
      throw new Error('Invalid English translation entry.');
  for (const [id, mode] of Object.entries(translation.modes ?? {})) {
    if (!modes.has(id))
      throw new Error(`English translation references unknown mode: ${id}`);
    if (
      (mode.label !== undefined && typeof mode.label !== 'string') ||
      (mode.description !== undefined && typeof mode.description !== 'string')
    )
      throw new Error('Invalid English mode translation.');
  }
}
for (const entry of await readdir(template)) {
  if (
    [
      '.git',
      'node_modules',
      'dist',
      'coverage',
      '.tmp',
      '.npmrc',
      '.npmignore',
      '.gitignore',
      '.env',
      '.serena',
      '.claude',
    ].includes(entry)
  )
    continue;
  await cp(resolve(template, entry), resolve(destination, entry), {
    recursive: true,
    force: false,
    errorOnExist: true,
    filter: (path) =>
      ![
        'public/downloads',
        '.github/workflows/release.yml',
        'scripts/check-npm-release.mjs',
        'scripts/verify-release.mjs',
        'scripts/check-package.mjs',
        'scripts/copy-cli-assets.mjs',
        'tsconfig.cli.json',
      ].includes(relative(template, path).replaceAll('\\', '/')),
  });
}
const ignore = await readFile(
  new URL('../.gitignore', import.meta.url),
  'utf8',
).catch(() =>
  readFile(new URL('./template.gitignore', import.meta.url), 'utf8'),
);
await writeFile(resolve(destination, '.gitignore'), ignore);
const metadata = JSON.parse(
  await readFile(resolve(destination, 'package.json'), 'utf8'),
);
metadata.name = `@kubohiroya/${config.slug}`;
metadata.description = config.summary;
metadata.private = true;
for (const key of ['bin', 'files', 'publishConfig']) delete metadata[key];
for (const key of ['prepack', 'pack:check', 'build:cli', 'test:release'])
  delete metadata.scripts[key];
metadata.repository.url = `git+https://github.com/kubohiroya/${config.slug}.git`;
metadata.homepage = `https://github.com/kubohiroya/${config.slug}#readme`;
metadata.bugs = { url: `https://github.com/kubohiroya/${config.slug}/issues` };
await writeFile(
  resolve(destination, 'package.json'),
  JSON.stringify(metadata, null, 2) + '\n',
);
await writeFile(
  resolve(destination, 'config/app.json'),
  JSON.stringify(config, null, 2) + '\n',
);
await writeFile(resolve(destination, 'README.md'), readmeEn(config));
await writeFile(resolve(destination, 'README.ja.md'), readmeJa(config));
console.log(`Initialized ${config.slug}; Git metadata was preserved.`);
