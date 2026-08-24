/**
 * Runs the REAL src/index.js under the mock runner against a scratch git
 * repository, so the entry point's own plumbing — reading history, dispatching
 * on dryRun, writing the changelog, stamping version files — is exercised
 * rather than only the modules underneath it.
 *
 * Scratch lives under the compiled Tests directory rather than os.tmpdir():
 * Tests/L0.ts reconstructs the path independently to assert on the produced
 * files, and a fixed name in the shared temp dir is pre-creatable by any local
 * user, so these writes could be redirected through a planted symlink
 * (CWE-377/378).
 */

import tmrm = require('azure-pipelines-task-lib/mock-run');
import { execFileSync } from 'child_process';
import fs = require('fs');
import path = require('path');

export const SCRATCH_DIR = path.join(__dirname, '.scratch', 'entrypoint-release');
export const CHANGELOG = path.join(SCRATCH_DIR, 'CHANGELOG.md');
export const MANIFEST = path.join(SCRATCH_DIR, 'manifest.json');

fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
fs.mkdirSync(SCRATCH_DIR, { recursive: true });

const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: SCRATCH_DIR, encoding: 'utf8', windowsHide: true });

git('init', '--quiet', '--initial-branch=main');
git('config', 'user.email', 'test@example.invalid');
git('config', 'user.name', 'Test');
git('config', 'commit.gpgsign', 'false');

fs.writeFileSync(CHANGELOG, '# Changelog\n\nAll notable changes.\n');
fs.writeFileSync(MANIFEST, '{\n  "name": "scratch",\n  "version": "0.1.0"\n}\n');
git('add', '.');
git('commit', '--quiet', '-m', 'chore: seed');
git('tag', 'v0.1.0');

fs.writeFileSync(path.join(SCRATCH_DIR, 'a.txt'), 'a');
git('add', '.');
git('commit', '--quiet', '-m', 'feat(core): add the thing');

fs.writeFileSync(path.join(SCRATCH_DIR, 'b.txt'), 'b');
git('add', '.');
git('commit', '--quiet', '-m', 'Merged PR 42: fix(api): stop the crash');

const tp = path.join(__dirname, '..', 'src', 'index.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);

tr.setInput('workingDirectory', SCRATCH_DIR);
tr.setInput('changelogPath', 'CHANGELOG.md');
tr.setInput('tagPrefix', 'v');
tr.setInput('targetBranch', 'main');
tr.setInput('capZeroMajor', 'true');
tr.setInput('versionFiles', 'manifest.json#$.version');
tr.setInput('commitLimit', '100');
tr.setInput('openPullRequest', 'false');
tr.setInput('dryRun', 'false');

// getPathInput(check=true) calls tl.checkPath, which under the mock runner is
// answered from this table rather than from the filesystem.
tr.setAnswers({ checkPath: { [SCRATCH_DIR]: true } });

tr.run();
