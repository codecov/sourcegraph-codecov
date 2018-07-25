import { ResolvedURI } from './uri'

/** The response data from the Codecov API for a commit. */
export interface CodecovCommitData {
  commit: {
    commitid: string
    report: {
      files: {
        [path: string]: {
          /** Line coverage data for this file at this commit.. */
          l: {
            /**
             * The coverage for the line (1-indexed).
             * @type {number} number of hits on a fully covered line
             * @type {string} "(partial hits)/branches" on a partially covered line
             * @type {null} skipped line
             */
            [line: number]: number | string | null
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
    service: 'github' | string

    /** For GitHub, the name of the repository's owner. */
    username: string
  }
  repo: {
    /** The repository name (without the owner). */
    name: string
  }
}

/** The arguments for getCommitCoverageData. */
export interface GetCommitCoverageDataArgs {
  /**
   * The base URL of the Codecov instance.
   * @example https://codecov.io
   */
  baseURL: string

  /** The identifier for the service where the repository lives. */
  service: 'gh' | string

  /** The value for the :owner URL parameter (the repository's owner). */
  owner: string

  /** The value for the :repo URL parameter (the repository's name). */
  repo: string

  /** The value for the :sha URL parameter (the Git commit SHA). */
  sha: string

  /** The Codecov API token (required for private repositories). */
  token?: string
}

/**
 * Gets the Codecov coverage data for a single commit of a repository.
 *
 * See https://docs.codecov.io/v5.0.0/reference#section-get-a-single-commit.
 */
export const getCommitCoverageData = memoizeAsync(
  async (args: GetCommitCoverageDataArgs): Promise<any> =>
    (await fetch(commitCoverageDataURL(args), {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'X-Requested-By': 'cx-codecov' },
    })).json(),
  commitCoverageDataURL
)

/**
 * Constructs the URL for Codecov coverage data for a single commit of a repository.
 *
 * See https://docs.codecov.io/v5.0.0/reference#section-get-a-single-commit.
 */
function commitCoverageDataURL({
  baseURL,
  service,
  owner,
  repo,
  sha,
  token,
}: GetCommitCoverageDataArgs): string {
  // The ?src=extension is necessary to get the data for all files in the response.
  return `${baseURL}/api/${service}/${owner}/${repo}/commits/${sha}?src=extension&access_token=${token}`
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
