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
export function resolveURI (uri: string): ResolvedURI {
    const url = new URL(uri)
    return {
        repo: (url.host + url.pathname).replace(/^\/*/, ''),
        rev: url.search.slice(1),
        path: url.hash.slice(1),
    }
}

export interface KnownHost {
    name: string;
    service: string;
}

/**
 * Returns the URL parameters used to access the Codecov API for the URI's repository.
 *
 * Currently only GitHub.com repositories are supported.
 */
export function codecovParamsForRepositoryCommit (
    uri: Pick<ResolvedURI, 'repo' | 'rev'>
): Pick<CodecovGetCommitCoverageArgs, 'baseURL' | 'service' | 'owner' | 'repo' | 'sha'> {
    try {
        const endpoints: Readonly<Endpoint[]> | undefined = sourcegraph.configuration.get<Settings>().get('codecov.endpoints')
        const baseURL: string = endpoints && endpoints[0] && endpoints[0].url || ''

        const knownHosts: KnownHost[] = [
            { name: 'github.com', service: 'gh' },
            { name: 'gitlab.com', service: 'gl' },
            { name: 'bitbucket.org', service: 'bb' },
        ];


        const knownHost: KnownHost | undefined = knownHosts.find(knownHost => uri.repo.includes(knownHost.name))

        let service: string = endpoints && endpoints[0] && endpoints[0].service || 'gh'

        const [, owner, repo] = uri.repo.split('/', 4)

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
