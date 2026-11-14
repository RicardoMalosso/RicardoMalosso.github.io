import { spawnSync } from 'node:child_process';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const build = spawnSync(npm, ['run', 'build'], { stdio: 'inherit', env: {...process.env, VITE_RUNTIME_CONTENT: 'true'} });
if (build.status !== 0) process.exit(build.status ?? 1);
const tests = spawnSync(process.execPath, ['--test', 'tests/browser/runtime.spec.mjs'], {stdio:'inherit'});
process.exit(tests.status ?? 1);
