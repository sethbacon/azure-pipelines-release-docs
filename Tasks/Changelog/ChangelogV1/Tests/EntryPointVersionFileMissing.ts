/**
 * Runs the REAL src/index.js under the mock runner against a scratch git
 * repository whose versionFiles input names a file that does not exist. The
 * task must FAIL rather than silently warn-and-continue (#126): a typo'd path
 * would otherwise ship a release with that manifest's version un-bumped.
 */

import tmrm = require('azure-pipelines-task-lib/mock-run');
import { execFileSync } from 'child_process';
import fs = require('fs');
import path = require('path');

export const SCRATCH_DIR = path.join(__dirname, '.scratch', 'entrypoint-version-file-missing');
export const CHANGELOG = path.join(SCRATCH_DIR, 'CHANGELOG.md');

fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
fs.mkdirSync(SCRATCH_DIR, { recursive: true });

const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: SCRATCH_DIR, encoding: 'utf8', windowsHide: true });

git('init', '--quiet', '--initial-branch=main');
git('config', 'user.email', 'test@example.invalid');
git('config', 'user.name', 'Test');
git('config', 'commit.gpgsign', 'false');

fs.writeFileSync(CHANGELOG, '# Changelog\n\nAll notable changes.\n');
git('add', '.');
git('commit', '--quiet', '-m', 'chore: seed');
git('tag', 'v0.1.0');

fs.writeFileSync(path.join(SCRATCH_DIR, 'a.txt'), 'a');
git('add', '.');
git('commit', '--quiet', '-m', 'feat(core): add the thing');

// Deliberately NOT created: manifest.json does not exist in this scratch repo.
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

tr.setAnswers({ checkPath: { [SCRATCH_DIR]: true } });

tr.run();
