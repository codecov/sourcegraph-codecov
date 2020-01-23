/**
 * Creates a function that memoizes the async result of func. If the Promise is rejected, the result will not be
 * cached.
 *
 * @param toKey etermines the cache key for storing the result based on the first argument provided to the memoized
 * function
 */
export function memoizeAsync<P, T>(
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
