import tasks = require('azure-pipelines-task-lib/task');
import fs = require('fs');
import path = require('path');

import { parseCommits, hasReleasableChange } from './conventional';
import { formatVersion, nextVersion, parseVersion } from './version';
import { renderRelease, spliceRelease } from './changelog';
import { commitsSince, defaultRunner, latestReleaseTag } from './git';
import { parseVersionFiles, stampJson } from './version-files';
import { sanitizeOutputVariableValue } from './output-variable';
import { isWithinWorkingDirectory } from './path-containment';
import { resolveToken, AdoConnection } from './ado-client';
import { createReleasePr, findOpenReleasePr, fitDescription, releaseBranchName, updateReleasePr } from './release-pr';

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

// An output variable is emitted as `##vso[task.setvariable ...]` and expanded by
// later steps into scripts, so every value crossing it is validated first and a
// value that cannot be is dropped rather than emitted raw.
function setOutputVariable(name: string, value: unknown): void {
    const safeValue = sanitizeOutputVariableValue(value);
    if (safeValue === null) {
        tasks.warning(tasks.loc('OutputVariableRejected', name));
        return;
    }
    tasks.setVariable(name, safeValue, false, true);
}

// Read-and-handle-ENOENT rather than exists-then-read: the check-then-use pair
// is a file-system race (CWE-367), and the answer to "does it exist" is stale
// the instant it is returned.
function readIfPresent(file: string): string | null {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
    }
}

async function run(): Promise<void> {
    try {
        tasks.setResourcePath(path.join(__dirname, '..', 'task.json'));
        const workingDirectory = tasks.getPathInput('workingDirectory', false, true) || process.cwd();
        const changelogPath = tasks.getInput('changelogPath', false) || 'CHANGELOG.md';
        const tagPrefix = tasks.getInput('tagPrefix', false) ?? 'v';
        const capZeroMajor = tasks.getBoolInput('capZeroMajor', false);
        const dryRun = tasks.getBoolInput('dryRun', false);
        const commitLimit = Number(tasks.getInput('commitLimit', false) || '500');
        const targetBranch = (tasks.getInput('targetBranch', false) || 'main').replace(/^refs\/heads\//, '');

        const run_ = defaultRunner(workingDirectory);
        const lastTag = latestReleaseTag(run_, tagPrefix);
        const current = (lastTag && parseVersion(lastTag)) || { major: 0, minor: 0, patch: 0 };

        const raw = commitsSince(run_, lastTag, commitLimit);
        const commits = parseCommits(raw);
        console.log(tasks.loc('CommitsConsidered', raw.length, commits.length, lastTag ?? 'the start of history'));

        if (!hasReleasableChange(commits)) {
            console.log(tasks.loc('NothingToRelease'));
            tasks.setVariable('releaseRequired', 'false', false, true);
            tasks.setResult(tasks.TaskResult.Succeeded, tasks.loc('NothingToRelease'));
            return;
        }

        const { version, bump } = nextVersion(current, commits, capZeroMajor);
        const versionText = formatVersion(version);
        console.log(tasks.loc('VersionResolved', formatVersion(current), versionText, bump));

        const section = renderRelease({ version, date: today(), commits });

        const changelogFile = path.resolve(workingDirectory, changelogPath);
        if (!isWithinWorkingDirectory(changelogFile, workingDirectory)) {
            throw new Error(tasks.loc('PathEscapesWorkingDirectory', changelogPath));
        }
        const existing = readIfPresent(changelogFile) ?? '';
        const updated = spliceRelease(existing, section);

        const stamped: string[] = [];
        for (const file of parseVersionFiles(tasks.getInput('versionFiles', false))) {
            const absolute = path.resolve(workingDirectory, file.path);
            if (!isWithinWorkingDirectory(absolute, workingDirectory)) {
                throw new Error(tasks.loc('PathEscapesWorkingDirectory', file.path));
            }
            const source = readIfPresent(absolute);
            if (source === null) {
                tasks.warning(tasks.loc('VersionFileMissing', file.path));
                continue;
            }
            const next = stampJson(source, file.jsonpath, versionText);
            if (next === null) {
                throw new Error(tasks.loc('VersionFileUnstampable', file.path, file.jsonpath));
            }
            if (!dryRun) fs.writeFileSync(absolute, next, 'utf8');
            stamped.push(file.path);
        }

        if (!dryRun) fs.writeFileSync(changelogFile, updated, 'utf8');

        tasks.setVariable('releaseRequired', 'true', false, true);
        setOutputVariable('nextVersion', versionText);
        setOutputVariable('previousVersion', formatVersion(current));
        setOutputVariable('bumpType', bump);

        if (dryRun) {
            console.log(tasks.loc('DryRunSummary', versionText, changelogPath, stamped.length));
            console.log(section);
            tasks.setResult(tasks.TaskResult.Succeeded, tasks.loc('DryRunComplete', versionText));
            return;
        }

        if (!tasks.getBoolInput('openPullRequest', false)) {
            tasks.setResult(tasks.TaskResult.Succeeded, tasks.loc('FilesUpdated', versionText));
            return;
        }

        const connection: AdoConnection = {
            collectionUri: tasks.getVariable('System.TeamFoundationCollectionUri') || '',
            project: tasks.getVariable('System.TeamProject') || '',
            repositoryId: tasks.getVariable('Build.Repository.ID') || '',
            token: resolveToken(tasks.getInput('accessToken', false)),
        };
        if (!connection.collectionUri || !connection.project || !connection.repositoryId) {
            throw new Error(tasks.loc('PipelineContextMissing'));
        }

        const sourceBranch = releaseBranchName(targetBranch);
        const title = tasks.loc('ReleasePrTitle', versionText);
        const description = fitDescription(section);

        const existingPr = await findOpenReleasePr(connection, sourceBranch, targetBranch);
        const pr = existingPr
            ? (await updateReleasePr(connection, existingPr.pullRequestId, title, description), existingPr)
            : await createReleasePr(connection, sourceBranch, targetBranch, title, description);

        setOutputVariable('releasePullRequestId', String(pr.pullRequestId));
        tasks.setResult(tasks.TaskResult.Succeeded, tasks.loc('ReleasePrReady', versionText, pr.pullRequestId));
    } catch (error) {
        tasks.setResult(tasks.TaskResult.Failed, error instanceof Error ? error.message : String(error));
    }
}

void run();
