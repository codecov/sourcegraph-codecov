import { CodecovGetCommitCoverageArgs } from './api'

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
    if (url.protocol === 'git:') {
        return {
            repo: (url.host + url.pathname).replace(/^\/*/, '').toLowerCase(),
            rev: url.search.slice(1).toLowerCase(),
            path: url.hash.slice(1),
        }
    }
    throw new Error(
        `unrecognized URI: ${JSON.stringify(uri)} (supported URI schemes: git)`
    )
}

/**
 * Returns the URL parameters used to access the Codecov API for the URI's repository.
 *
 * Currently only GitHub.com repositories are supported.
 */
export function codecovParamsForRepositoryCommit(
    uri: Pick<ResolvedURI, 'repo' | 'rev'>
): Pick<CodecovGetCommitCoverageArgs, 'service' | 'owner' | 'repo' | 'sha'> {

    const hosts: any[] = [
        { name: 'github.com', alias: 'gh' },
        { name: 'gitlab.com', alias: 'gl' },
        { name: 'bitbucket.org', alias: 'bb' },
    ];

    const host: any = hosts.find((host: any) => {
        if (uri.repo.includes(host.name)) {
            return host;
        }
    });

    if (host) {
        const parts: string[] = uri.repo.split('/', 4);

        if (parts.length !== 3) {
            throw new Error(
                `invalid GitHub.com repository: ${JSON.stringify(
                    uri.repo
                )} (expected "github.com/owner/repo")`
            )
        }

        console.log('result', {
            service: host.alias,
            owner: parts[1],
            repo: parts[2],
            sha: uri.rev,
        })

        return {
            service: host.alias,
            owner: parts[1],
            repo: parts[2],
            sha: uri.rev,
        }
    }
    throw new Error(
        `extension does not yet support the repository ${JSON.stringify(
            uri.repo
        )}`
    )
}
