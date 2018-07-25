import { ParsedURI } from './model'

export interface GetCoverageArgs
  extends Pick<ParsedURI, Exclude<keyof ParsedURI, 'path'>> {
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
