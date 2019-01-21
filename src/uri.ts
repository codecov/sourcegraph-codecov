import * as sourcegraph from 'sourcegraph'
import { CodecovGetCommitCoverageArgs } from './api'
import { resolveEndpoint, Settings, Endpoint, Location } from './settings';

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
    // if (url.protocol === 'git:') {
    return {
        repo: (url.host + url.pathname).replace(/^\/*/, '').toLowerCase(),
        rev: url.search.slice(1).toLowerCase(),
        path: url.hash.slice(1),
    }
    // }
    // throw new Error(
    //     `unrecognized URI: ${JSON.stringify(uri)} (supported URI schemes: git)`
    // )
}

/**
 * Returns the URL parameters used to access the Codecov API for the URI's repository.
 *
 * Currently only GitHub.com repositories are supported.
 */
export function codecovParamsForRepositoryCommit(
    uri: Pick<ResolvedURI, 'repo' | 'rev'>
): Pick<CodecovGetCommitCoverageArgs, 'service' | 'owner' | 'repo' | 'sha'> {


    // const hosts: any[] = [
    //     { name: 'github.com', service: 'gh' },
    //     { name: 'gitlab.com', service: 'gl' },
    //     { name: 'bitbucket.org', service: 'bb' },
    // ];

    const location: Location | undefined = sourcegraph.configuration.get<Settings>().get('codecov.location')

    // if (location && location.versionControlLocation && location.versionControlType) {
    //     hosts.push({
    //         name: location.versionControlLocation,
    //         service: location.versionControlType,
    //     });

    //     console.log(hosts)
    // }

    // console.log(uri)

    // const host: any = hosts.find((host: any) => {
    //     if (uri.repo.includes(host.name)) {
    //         return host;
    //     }
    // });

    // if (host) {


    //     console.log(parts)

    //     if (parts.length !== 3) {
    //         throw new Error(
    //             `invalid GitHub.com repository: ${JSON.stringify(
    //                 uri.repo
    //             )} (expected "github.com/owner/repo")`
    //         )
    //     }

    //     console.log('result', {
    //         service: host.service,
    //         owner: parts[1],
    //         repo: parts[2],
    //         sha: uri.rev,
    //     })

    //     return {
    //         service: host.service,
    //         owner: parts[1],
    //         repo: parts[2],
    //         sha: uri.rev,
    //     }
    // }

    const parts: string[] = uri.repo.split('/', 4);

    return {
        service: location && location.versionControlType || 'gh',
        owner: parts[1],
        repo: parts[2],
        sha: uri.rev,
    };

    // throw new Error(
    //     `extension does not yet support the repository ${JSON.stringify(
    //         uri.repo
    //     )}`
    // )
}
