/**
 * The Azure DevOps REST calls this task makes, and the token it makes them with.
 *
 * TOKEN. The job's own identity, read from the `SystemVssConnection` endpoint,
 * exactly as the sibling extension's id-token-generator does. The extension
 * manifest deliberately does NOT request `vso.code_write`: extension scopes
 * govern accesses made with the EXTENSION's identity, and raising them would
 * re-prompt every installing organisation for consent and grant repo write to
 * the whole extension for the benefit of one task. What actually gates this is
 * the Build Service account's permissions on the target repository, which is a
 * decision the owner of that repository makes.
 *
 * TRANSPORT. @4cloudguru/pipeline-task-core's httpsRequest: https-only, a socket
 * timeout, a response byte cap and proxy support. A non-2xx is a result there,
 * not an exception, so the retry policy below is this task's own.
 */

import tasks = require('azure-pipelines-task-lib/task');
import {
    httpsRequest,
    isRetryableHttpStatus,
    retryAsync,
    scrubSecretsFromMessage,
} from '@4cloudguru/pipeline-task-core';

/** Ceiling on a single REST call. */
const REQUEST_TIMEOUT_MS = 30_000;

/** Wall-clock budget across all attempts of one call. */
const RETRY_BUDGET_MS = 60_000;

export interface AdoConnection {
    readonly collectionUri: string;
    readonly project: string;
    readonly repositoryId: string;
    readonly token: string;
}

/**
 * Read the job's access token and register it — and its base64 form — with the
 * agent's log masker before it is used anywhere.
 *
 * The base64 registration is not belt-and-braces: the token travels in a
 * `Basic` header as `:<token>` base64-encoded, and a transport error that echoes
 * the request headers would otherwise print the encoded form in full.
 */
export function resolveToken(explicit?: string): string {
    const token =
        (explicit && explicit.trim()) ||
        tasks.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false) ||
        '';

    if (!token) {
        throw new Error(tasks.loc('AccessTokenUnavailable'));
    }

    tasks.setSecret(token);
    tasks.setSecret(Buffer.from(`:${token}`).toString('base64'));
    return token;
}

function authHeader(token: string): string {
    return `Basic ${Buffer.from(`:${token}`).toString('base64')}`;
}

export interface AdoResponse {
    readonly status: number;
    readonly body: string;
    /** Carried so a failure message can scrub the URL it came from. */
    readonly url: string;
}

/** The transport, injectable so the retry policy can be driven without a network. */
export type Transport = (options: {
    method: string;
    url: URL;
    headers?: Record<string, string>;
    body?: Buffer;
    timeoutMs?: number;
}) => Promise<{ status: number; body: string }>;

/**
 * One REST call, retried on transport failure and on the retryable 5xx/429 set
 * only. A received 4xx is never retried: it is an answer, and repeating it
 * cannot change it.
 */
export async function adoRequest(
    connection: AdoConnection,
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    body?: unknown,
    transport: Transport = httpsRequest as unknown as Transport,
): Promise<AdoResponse> {
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body), 'utf8');

    return retryAsync(
        async () => {
            const response = await transport({
                url: new URL(url),
                method,
                headers: {
                    Authorization: authHeader(connection.token),
                    Accept: 'application/json',
                    ...(payload ? { 'Content-Type': 'application/json' } : {}),
                },
                body: payload,
                timeoutMs: REQUEST_TIMEOUT_MS,
            });
            return { status: response.status, body: response.body ?? '', url };
        },
        {
            retries: 3,
            baseDelayMs: 1,
            maxElapsedMs: RETRY_BUDGET_MS,
            retryResult: (r) => isRetryableHttpStatus(r.status),
            // A rejection here is always a bare transport failure: httpsRequest
            // resolves (never rejects) for any received HTTP response, so
            // retryResult above is what handles a captured 5xx/429. Whether the
            // request reached the server before failing is unknown, so retrying
            // is safe only for GET (idempotent) -- a POST/PATCH could duplicate
            // or double-apply an already-processed request (mirrors
            // PublishKbArticleV1's nonIdempotentCreateRetryError).
            retryError: () => method === 'GET',
        },
    );
}

/** Parse a REST body, failing with the server's own message rather than a parser error. */
export function parseJson<T>(response: AdoResponse, what: string): T {
    if (response.status < 200 || response.status >= 300) {
        const detail = scrubSecretsFromMessage(response.body.slice(0, 500), response.url, []);
        throw new Error(tasks.loc('AdoRequestFailed', what, response.status, detail));
    }
    try {
        return JSON.parse(response.body) as T;
    } catch {
        throw new Error(tasks.loc('AdoResponseUnparseable', what));
    }
}
