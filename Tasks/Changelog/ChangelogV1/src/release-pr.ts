/**
 * Creating and updating the release pull request.
 *
 * The release branch is derived from the version, not taken as input, so a
 * second run for the same version finds and updates its own PR instead of
 * opening a duplicate — the property release-please relies on.
 */

import tasks = require('azure-pipelines-task-lib/task');
import { validateUrlPathSegment } from '@4cloudguru/pipeline-task-core';
import { AdoConnection, AdoResponse, adoRequest, parseJson } from './ado-client';

const API_VERSION = '7.1';

/** The transport, injectable so these can be driven without a network. */
export type RequestFn = (
    connection: AdoConnection,
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    body?: unknown,
) => Promise<AdoResponse>;

export interface PullRequestRef {
    readonly pullRequestId: number;
    readonly url: string;
}

interface PullRequestList {
    readonly value?: Array<{ pullRequestId: number; sourceRefName: string }>;
}

/** `release-please--branches--main` in release-please's scheme; the same idea, ours. */
export function releaseBranchName(targetBranch: string): string {
    return `release/${targetBranch.replace(/^refs\/heads\//, '')}`;
}

/**
 * The ADO REST base URL for this connection's repository.
 *
 * @egress-reviewed: the host segment is `connection.collectionUri`, read from
 * the job's own `System.TeamFoundationCollectionUri` variable (see index.ts) --
 * the ADO agent supplies this, not a pipeline author or a response body, so
 * there is no operator- or attacker-controlled destination for a runtime
 * allowlist to gate here. The path segments after it ARE operator/agent
 * supplied and are validated below.
 */
function repoBase(connection: AdoConnection): string {
    const collection = connection.collectionUri.replace(/\/+$/, '');
    // Each segment is operator- or agent-supplied and lands in a URL path.
    validateUrlPathSegment('project', connection.project);
    validateUrlPathSegment('repositoryId', connection.repositoryId);
    return `${collection}/${encodeURIComponent(connection.project)}/_apis/git/repositories/${encodeURIComponent(connection.repositoryId)}`;
}

/** The open PR from `sourceBranch`, or null. */
export async function findOpenReleasePr(
    connection: AdoConnection,
    sourceBranch: string,
    targetBranch: string,
    request: RequestFn = adoRequest,
): Promise<PullRequestRef | null> {
    const url =
        `${repoBase(connection)}/pullrequests` +
        `?searchCriteria.sourceRefName=${encodeURIComponent(`refs/heads/${sourceBranch}`)}` +
        `&searchCriteria.targetRefName=${encodeURIComponent(`refs/heads/${targetBranch}`)}` +
        `&searchCriteria.status=active&api-version=${API_VERSION}`;

    const list = parseJson<PullRequestList>(await request(connection, 'GET', url), 'list pull requests');
    const first = list.value?.[0];
    return first ? { pullRequestId: first.pullRequestId, url } : null;
}

export async function createReleasePr(
    connection: AdoConnection,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    description: string,
    request: RequestFn = adoRequest,
): Promise<PullRequestRef> {
    const url = `${repoBase(connection)}/pullrequests?api-version=${API_VERSION}`;
    const created = parseJson<{ pullRequestId: number }>(
        await request(connection, 'POST', url, {
            sourceRefName: `refs/heads/${sourceBranch}`,
            targetRefName: `refs/heads/${targetBranch}`,
            title,
            description,
        }),
        'create pull request',
    );
    tasks.debug(`Created release pull request ${created.pullRequestId}`);
    return { pullRequestId: created.pullRequestId, url };
}

export async function updateReleasePr(
    connection: AdoConnection,
    pullRequestId: number,
    title: string,
    description: string,
    request: RequestFn = adoRequest,
): Promise<void> {
    const url = `${repoBase(connection)}/pullrequests/${pullRequestId}?api-version=${API_VERSION}`;
    parseJson<unknown>(await request(connection, 'PATCH', url, { title, description }), 'update pull request');
    tasks.debug(`Updated release pull request ${pullRequestId}`);
}

/**
 * Azure DevOps caps a PR description at 4000 characters and REJECTS a longer
 * one rather than truncating it. Truncating here instead would silently ship
 * a PR whose description doesn't match what CHANGELOG.md actually records --
 * a loud failure at the point of opening the PR is preferable to that.
 */
export const MAX_DESCRIPTION = 4000;

export function fitDescription(body: string): string {
    if (body.length <= MAX_DESCRIPTION) return body;
    throw new Error(tasks.loc('ReleasePrDescriptionTooLong', body.length, MAX_DESCRIPTION));
}
