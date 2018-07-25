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
    /** An identifier for the code host or other service where this repository lives. */
    service: 'github' | string

    /** For GitHub, the name of the repository's owner. */
    username: string
  }
  repo: {
    /** The repository name (without the owner). */
    name: string
  }
}

export interface GetCoverageArgs
  extends Pick<ResolvedURI, Exclude<keyof ResolvedURI, 'path'>> {
  token: string | undefined
}

export const getCoverageForRepoRev = memoizeAsync(
  async ({ token, repo, rev }: GetCoverageArgs): Promise<any> => {
    // TODO: support other code hosts
    const codeHost = 'gh'
    repo = repo.replace(/^github\.com\//, '')

    // TODO: support self-hosted codecov (not just codecov.io)
    const resp = await fetch(
      `https://codecov.io/api/${codeHost}/${repo}/commits/${rev}?src=extension`,
      {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        headers: token ? { Authorization: `token ${token}` } : undefined,
      }
    )
    return resp.json()
  },
  ({ token, repo, rev }) => `${token}:${repo}:${rev}`
)

/**
 * Creates a function that memoizes the async result of func. If the Promise is rejected, the result will not be
 * cached.
 *
 * @param toKey If resolver provided, it determines the cache key for storing the result based on the first
 * argument provided to the memoized function.
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
