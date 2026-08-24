/**
 * The other half of the entry point: a history containing only silent types.
 * The task must report "nothing to release" and write NOTHING — a version cut
 * from an all-chore batch produces a release whose changelog section is empty.
 */

import tmrm = require('azure-pipelines-task-lib/mock-run');
import { execFileSync } from 'child_process';
import fs = require('fs');
import path = require('path');

export const SCRATCH_DIR = path.join(__dirname, '.scratch', 'entrypoint-noop');
export const CHANGELOG = path.join(SCRATCH_DIR, 'CHANGELOG.md');
export const ORIGINAL_CHANGELOG = '# Changelog\n\nAll notable changes.\n';

fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
fs.mkdirSync(SCRATCH_DIR, { recursive: true });

const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: SCRATCH_DIR, encoding: 'utf8', windowsHide: true });

git('init', '--quiet', '--initial-branch=main');
git('config', 'user.email', 'test@example.invalid');
git('config', 'user.name', 'Test');
git('config', 'commit.gpgsign', 'false');

fs.writeFileSync(CHANGELOG, ORIGINAL_CHANGELOG);
git('add', '.');
git('commit', '--quiet', '-m', 'chore: seed');
git('tag', 'v1.0.0');

fs.writeFileSync(path.join(SCRATCH_DIR, 'a.txt'), 'a');
git('add', '.');
git('commit', '--quiet', '-m', 'chore: tidy up');

fs.writeFileSync(path.join(SCRATCH_DIR, 'b.txt'), 'b');
git('add', '.');
git('commit', '--quiet', '-m', 'not a conventional commit at all');

const tp = path.join(__dirname, '..', 'src', 'index.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);

tr.setInput('workingDirectory', SCRATCH_DIR);
tr.setInput('changelogPath', 'CHANGELOG.md');
tr.setInput('tagPrefix', 'v');
tr.setInput('capZeroMajor', 'true');
tr.setInput('openPullRequest', 'false');
tr.setInput('dryRun', 'false');

tr.setAnswers({ checkPath: { [SCRATCH_DIR]: true } });

tr.run();
