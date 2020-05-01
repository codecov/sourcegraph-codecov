import { APIOptions, CommitSpec, RepoSpec } from './api'
import { resolveEndpoint, Settings } from './settings'

/**
 * A resolved URI without an identified path.
 */
export interface ResolvedRootURI {
    repo: string
    rev: string
}

/**
 * A resolved URI with an identified path in a repository at a specific revision.
 */
export interface ResolvedDocumentURI extends ResolvedRootURI {
    path: string
}

/**
 * Resolve a URI of the form git://github.com/owner/repo?rev to an absolute reference.
 */
export function resolveRootURI(uri: string): ResolvedRootURI {
    const url = new URL(uri)
    if (url.protocol !== 'git:') {
        throw new Error(`Unsupported protocol: ${url.protocol}`)
    }
    const repo = (url.host + url.pathname).replace(/^\/*/, '')
    const rev = url.search.slice(1)
    if (!rev) {
        throw new Error('Could not determine revision')
    }
    return { repo, rev }
}

/**
 * Resolve a URI of the form git://github.com/owner/repo?rev#path to an absolute reference.
 */
export function resolveDocumentURI(uri: string): ResolvedDocumentURI {
    return {
        ...resolveRootURI(uri),
        path: new URL(uri).hash.slice(1),
    }
}

const knownHosts = [
    { name: 'github.com', service: 'gh' },
    { name: 'gitlab.com', service: 'gl' },
    { name: 'bitbucket.org', service: 'bb' },
] as const

/**
 * Returns the URL parameters used to access the Codecov API for the URI's repository.
 *
 * Currently only GitHub.com repositories are supported.
 */
export function codecovParamsForRepositoryCommit(
    uri: Pick<ResolvedRootURI, 'repo' | 'rev'>,
    sourcegraph: typeof import('sourcegraph')
): RepoSpec & CommitSpec & APIOptions {
    const endpoint = resolveEndpoint(sourcegraph.configuration.get<Settings>().get('codecov.endpoints'))

    const knownHost = knownHosts.find(knownHost => uri.repo.includes(knownHost.name))

    const service = (knownHost?.service) || endpoint.service || 'gh'

    const [, owner, repo] = uri.repo.split('/', 4)

    return {
        baseURL: endpoint.url,
        service,
        owner,
        repo,
        sha: uri.rev,
        token: endpoint.token,
    }
}
