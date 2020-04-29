export type Service = 'gh' | 'ghe' | 'gl' | 'bb'

export interface RepoSpec {
    /** The identifier for the service where the repository lives. */
    service: Service

    /** The value for the :owner URL parameter (the repository's owner). */
    owner: string

    /** The value for the :repo URL parameter (the repository's name). */
    repo: string
}

export interface APIOptions {
    /**
     * The base URL of the Codecov instance.
     * @example https://codecov.io
     */
    baseURL: string

    /** The Codecov API token (required for private repositories). */
    token?: string
}

/**
 * Codecov API parameters for a commit.
 */
export interface CommitSpec {
    /** The value for the :sha URL parameter (the Git commit SHA). */
    sha: string
}
export interface PathSpec {
    path: string
}

export interface CodecovOwner {
    /** An identifier for the code host or other service where the repository lives. */
    service: 'github' | 'gitlab' | 'bitbucket'

    /** For GitHub, the name of the repository's owner. */
    username: string
}

export interface CodecovRepo {
    /** The repository name (without the owner). */
    name: string
}

/** The response data from the Codecov API for a commit. */
export interface CodecovCommitData {
    owner: CodecovOwner
    repo: CodecovRepo
    commit: {
        commitid: string
        report: {
            files: {
                [path: string]:
                    | undefined
                    | {
                          /** Line coverage data for this file at this commit.. */
                          l: {
                              /**
                               * The coverage for the line (1-indexed).
                               * @type {number} number of hits on a fully covered line
                               * @type {string} "(partial hits)/branches" on a partially covered line
                               * @type {null} skipped line
                               */
                              [line: number]: number | string | null | undefined
                          }

                          /** Totals for this file at this commit. */
                          t: {
                              /** The coverage ratio for this file, as a string (e.g., "62.5000000"). */
                              c: string
                          }
                      }
            }
        }
        totals: {
            /** The coverage ratio of the repository at this commit. */
            coverage: number
        }
    }
}

export interface CodecovTreeData {
    owner: CodecovOwner
    repo: CodecovRepo
    commit: {
        folder_totals: {
            /** Coverage as a stringified float. */
            coverage: string
        }
    }
}

/**
 * Gets the Codecov coverage data for a single commit of a repository.
 *
 * See https://docs.codecov.io/v5.0.0/reference#section-get-a-single-commit.
 */
export const getCommitCoverage = memoizeAsync(
    async (
        args: RepoSpec & CommitSpec & APIOptions
    ): Promise<CodecovCommitData | null> => {
        const response = await fetch(commitApiURL(args).href, {
            method: 'GET',
            mode: 'cors',
        })
        if (response.status === 404) {
            console.warn(
                `No Codecov coverage found for ${args.owner}/${args.repo}@${args.sha}`
            )
            return null
        }
        if (!response.ok) {
            throw new Error('Error while getting Codecov commit data')
        }
        return await response.json()
    },
    options => commitApiURL(options).href
)

export const getTreeCoverage = memoizeAsync(
    async (
        args: RepoSpec & CommitSpec & PathSpec & APIOptions
    ): Promise<CodecovTreeData | null> => {
        if (!args.path.replace(/\/+$/, '')) {
            throw new Error('Invalid path')
        }
        const response = await fetch(treeCoverageURL(args).href)
        if (response.status === 404) {
            console.warn(
                `No Codecov coverage found for ${args.owner}/${args.repo}@${args.sha}/${args.path}`
            )
            return null
        }
        if (!response.ok) {
            throw new Error('Error while getting Codecov commit data')
        }
        return await response.json()
    },
    options => commitApiURL(options).href
)

/**
 * Constructs the URL for Codecov coverage data for a single commit of a repository.
 *
 * See https://docs.codecov.io/v5.0.0/reference#section-get-a-single-commit.
 */
export function commitApiURL({
    baseURL,
    service,
    owner,
    repo,
    sha,
    token,
}: RepoSpec & CommitSpec & APIOptions): URL {
    const url = new URL(
        `${baseURL}/api/${service}/${owner}/${repo}/commits/${sha}`
    )
    // Necessary to get the data for all files in the response.
    url.searchParams.set('src', 'extension')
    setAccessToken(url, token)
    return url
}

/**
 * Adds the access token to a given URL if defined.
 */
export function setAccessToken(url: URL, token: string | undefined): void {
    if (token) {
        url.searchParams.set('access_token', token)
    }
}

/**
 * Constructs the URL for Codecov coverage data for a folder of a repository at a commit.
 */
function treeCoverageURL({
    baseURL,
    service,
    owner,
    repo,
    sha,
    token,
    path,
}: RepoSpec & CommitSpec & PathSpec & APIOptions): URL {
    const url = new URL(
        `${baseURL}/api/${service}/${owner}/${repo}/tree/${sha}/${path}`
    )
    setAccessToken(url, token)
    return url
}

interface GetGraphSVGOptions extends RepoSpec, Partial<CommitSpec>, APIOptions {
    graphType: 'icicle' | 'tree' | 'sunburst'
}

/**
 * Get a graph SVG from the API as text.
 */
export async function getGraphSVG({
    baseURL,
    owner,
    repo,
    service,
    sha,
    graphType,
    token,
}: GetGraphSVGOptions): Promise<string | null> {
    const url = new URL(`${baseURL}/api/${service}/${owner}/${repo}`)
    if (sha) {
        url.pathname += `/commit/${sha}`
    }
    url.pathname += `/graphs/${graphType}.svg`
    setAccessToken(url, token)

    const response = await fetch(url.href)
    if (response.status === 404) {
        return null
    }
    if (!response.ok) {
        throw new Error(
            `Could not fetch SVG: ${response.status} ${response.statusText}`
        )
    }

    return await response.text()
}

/**
 * Creates a function that memoizes the async result of func. If the Promise is rejected, the result will not be
 * cached.
 *
 * @param toKey etermines the cache key for storing the result based on the first argument provided to the memoized
 * function
 */
function memoizeAsync<P, T>(
    func: (params: P) => Promise<T>,
    toKey: (params: P) => string
): (params: P) => Promise<T> {
    const cache = new Map<string, Promise<T>>()
    return (params: P) => {
        const key = toKey(params)
        const hit = cache.get(key)
        if (hit) {
            return hit
        }
        const p = func(params)
        p.then(null, () => cache.delete(key))
        cache.set(key, p)
        return p
    }
}
