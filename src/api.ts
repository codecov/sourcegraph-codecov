import { memoizeAsync } from './memoizeAsync'

/** The arguments for getCommitCoverage. */
export interface CodecovGetCommitCoverageArgs {
    /**
     * The base URL of the Codecov instance.
     * @example https://codecov.io
     */
    baseURL: string

    /** The identifier for the service where the repository lives. */
    service: string

    /** The value for the :owner URL parameter (the repository's owner). */
    owner: string

    /** The value for the :repo URL parameter (the repository's name). */
    repo: string

    /** The value for the :sha URL parameter (the Git commit SHA). */
    sha: string

    /** The Codecov API token (required for private repositories). */
    token?: string
}

/** The response data from the Codecov API for a commit. */
export interface CodecovCommitData {
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
    owner: {
        /** An identifier for the code host or other service where the repository lives. */
        service: 'github' | 'gitlab' | 'bitbucket'

        /** For GitHub, the name of the repository's owner. */
        username: string
    }
    repo: {
        /** The repository name (without the owner). */
        name: string
    }
}

/**
 * Gets the Codecov coverage data for a single commit of a repository.
 *
 * See https://docs.codecov.io/v5.0.0/reference#section-get-a-single-commit.
 */
export const codecovGetCommitCoverage = memoizeAsync(
    async (
        args: CodecovGetCommitCoverageArgs
    ): Promise<CodecovCommitData | null> => {
        const response = await fetch(commitCoverageURL(args), {
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
    commitCoverageURL
)

/**
 * Constructs the URL for Codecov coverage data for a single commit of a repository.
 *
 * See https://docs.codecov.io/v5.0.0/reference#section-get-a-single-commit.
 */
function commitCoverageURL({
    baseURL,
    service,
    owner,
    repo,
    sha,
    token,
}: CodecovGetCommitCoverageArgs): string {
    const tokenSuffix = token
        ? `&access_token=${encodeURIComponent(token)}`
        : ''

    // The ?src=extension is necessary to get the data for all files in the response.
    return `${baseURL}/api/${service}/${owner}/${repo}/commits/${sha}?src=extension${tokenSuffix}`
}
