import * as sourcegraph from 'sourcegraph'
import { memoizeAsync } from './memoizeAsync'

interface ResolveRepoNameResponse {
    data?: {
        repository?: {
            uri: string
        }
    }
}

/**
 * Attempts to use the Sourcegraph graphQL API to resolve a repo name
 * parsed from a resource URI, possibly affected by repositoryPathPattern,
 * to the repo's URI, unaffected by repositoryPathPattern,
 * typically of the form "{host}/{nameWithOwner}" (eg. "github.com/sourcegraph/enterprise").
 *
 * Example: with `"repositoryPathPattern": "{nameWithOwner}"` set in synced repository
 * settings for a github.com code host, this would resolve the repo name "sourcegraph/enterprise"
 * to "github.com/sourcegraph/enterprise".
 *
 * If the graphQL request fails (this can happen on private repositories when the Sourcegraph
 * browser extension points to the public sourcegraph.com instance), the returned Promise
 * will resolve to the repo name passed as argument.
 */
export const resolveRepoName = memoizeAsync(async (name: string): Promise<string> => {
    try {
        const result = await sourcegraph.commands.executeCommand<
            ResolveRepoNameResponse
        >(
            'queryGraphQL',
            `query ResolveRepoURI($name: String!) {
                repository(name: $name) {
                    uri
                }
            }`,
            { name }
        )
        const uri = result?.data?.repository?.uri
        if (!uri) {
            throw new Error('bad response')
        }
        return uri
    } catch (err) {
        console.warn('Could not resolve repo name', err)
    }
    return name
}, name => name)
