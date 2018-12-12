import * as sourcegraph from 'sourcegraph'
import { CodecovGetCommitCoverageArgs } from './api'
import { Settings, Endpoint } from './settings';

/**
 * A resolved URI identifies a path in a repository at a specific revision.
 */
export interface ResolvedURI {
    repo: string
    rev: string
    path: string
}

/**
 * Resolve a URI of the forms git://github.com/owner/repo?rev#path and file:///path to an absolute reference, using
 * the given base (root) URI.
 */
export function resolveURI(uri: string): ResolvedURI {
    const url = new URL(uri)
    return {
        repo: (url.host + url.pathname).replace(/^\/*/, '').toLowerCase(),
        rev: url.search.slice(1).toLowerCase(),
        path: url.hash.slice(1),
    }
}

/**
 * Returns the URL parameters used to access the Codecov API for the URI's repository.
 *
 * Currently only GitHub.com repositories are supported.
 */
export function codecovParamsForRepositoryCommit(
    uri: Pick<ResolvedURI, 'repo' | 'rev'>
): Pick<CodecovGetCommitCoverageArgs, 'baseURL' | 'service' | 'owner' | 'repo' | 'sha'> {
    try {
        const endpoints: Endpoint[] | undefined = sourcegraph.configuration.get<Settings>().get('codecov.endpoints')
        const baseURL: string = endpoints && endpoints[0] && endpoints[0].url || ''

        const knownHosts: any[] = [
            { name: 'github.com', service: 'gh' },
            { name: 'gitlab.com', service: 'gl' },
            { name: 'bitbucket.org', service: 'bb' },
        ];

        const knownHost: any = knownHosts.find((knownHost: any) => {
            if (uri.repo.includes(knownHost.name)) {
                return knownHost;
            }
        });

        let service = endpoints && endpoints[0] && endpoints[0].service || 'gh'

        const parts = uri.repo.split('/', 4)

        const owner = parts[1];
        const repo = parts[2];

        service = knownHost && knownHost.service || service;

        return {
            baseURL,
            service,
            owner,
            repo,
            sha: uri.rev,
        };

    } catch (err) {
        throw new Error(
            `extension does not yet support the repository ${JSON.stringify(
                uri.repo
            )}`
        )
    }
}
