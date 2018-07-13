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
export function resolveURI(
    base: Pick<ResolvedURI, 'repo' | 'rev'> | null,
    uri: string
): ResolvedURI {
    const url = new URL(uri)
    if (url.protocol === 'git:') {
        return {
            repo: (url.host + url.pathname).replace(/^\/*/, '').toLowerCase(),
            rev: url.search.slice(1).toLowerCase(),
            path: url.hash.slice(1),
        }
    }
    if (url.protocol === 'file:') {
        if (!base) {
            throw new Error(`unable to resolve URI ${uri} with no base`)
        }
        return { ...base, path: url.pathname }
    }
    throw new Error(
        `unrecognized URI: ${JSON.stringify(
            uri
        )} (supported URI schemes: git, file)`
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
    // TODO: Support services (code hosts) other than GitHub.com, such as GitHub Enterprise, GitLab, etc.
    if (uri.repo.startsWith('github.com/')) {
        const parts = uri.repo.split('/', 4)
        if (parts.length !== 3) {
            throw new Error(
                `invalid GitHub.com repository: ${JSON.stringify(
                    uri.repo
                )} (expected "github.com/owner/repo")`
            )
        }
        return {
            service: 'gh',
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
