import { spawnSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['run', 'build', '--workspace', 'frontend'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
if (process.env.NEXT_OUTPUT !== 'standalone') {
  rmSync(new URL('../out', import.meta.url), { recursive: true, force: true });
  cpSync(new URL('../frontend/out', import.meta.url), new URL('../out', import.meta.url), {
    recursive: true,
  });
}
