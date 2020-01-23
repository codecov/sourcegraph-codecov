import { CodecovGetCommitCoverageArgs } from './api'
import { Endpoint, Settings } from './settings'

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
export async function resolveRootURI(
    uri: string,
    resolveRepoName: (name: string) => Promise<string>
): Promise<ResolvedRootURI> {
    const url = new URL(uri)
    if (url.protocol !== 'git:') {
        throw new Error(`Unsupported protocol: ${url.protocol}`)
    }
    const rawRepo = (url.host + url.pathname).replace(/^\/*/, '')
    const repo = await resolveRepoName(rawRepo)
    const rev = url.search.slice(1)
    if (!rev) {
        throw new Error('Could not determine revision')
    }
    return { repo, rev }
}

/**
 * Resolve a URI of the form git://github.com/owner/repo?rev#path to an absolute reference.
 */
export async function resolveDocumentURI(
    uri: string,
    resolveRepoName: (name: string) => Promise<string>
): Promise<ResolvedDocumentURI> {
    return {
        ...(await resolveRootURI(uri, resolveRepoName)),
        path: new URL(uri).hash.slice(1),
    }
}

export interface KnownHost {
    name: string
    service: string
}

/**
 * Returns the URL parameters used to access the Codecov API for the URI's repository.
 *
 * Currently only GitHub.com repositories are supported.
 */
export function codecovParamsForRepositoryCommit(
    uri: Pick<ResolvedRootURI, 'repo' | 'rev'>,
    sourcegraph: typeof import('sourcegraph')
): Pick<
    CodecovGetCommitCoverageArgs,
    'baseURL' | 'service' | 'owner' | 'repo' | 'sha'
> {
    try {
        const endpoints:
            | Readonly<Endpoint[]>
            | undefined = sourcegraph.configuration
            .get<Settings>()
            .get('codecov.endpoints')
        const baseURL: string =
            (endpoints && endpoints[0] && endpoints[0].url) || ''

        const knownHosts: KnownHost[] = [
            { name: 'github.com', service: 'gh' },
            { name: 'gitlab.com', service: 'gl' },
            { name: 'bitbucket.org', service: 'bb' },
        ]

        const knownHost: KnownHost | undefined = knownHosts.find(knownHost =>
            uri.repo.includes(knownHost.name)
        )

        let service: string =
            (endpoints && endpoints[0] && endpoints[0].service) || 'gh'

        const [, owner, repo] = uri.repo.split('/', 4)

        service = (knownHost && knownHost.service) || service

        return {
            baseURL,
            service,
            owner,
            repo,
            sha: uri.rev,
        }
    } catch (err) {
        throw new Error(
            `extension does not yet support the repository ${JSON.stringify(
                uri.repo
            )}`
        )
    }
}
