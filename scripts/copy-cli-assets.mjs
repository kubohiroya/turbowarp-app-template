import { URL } from 'node:url';
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
// npm does not preserve a root .gitignore; carry its source as an explicit CLI asset.
await copyFile(
  new URL('../.gitignore', import.meta.url),
  new URL('../dist/template.gitignore', import.meta.url),
);
