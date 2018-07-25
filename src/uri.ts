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
export function resolveURI(
  base: Pick<ResolvedURI, 'repo' | 'rev'> | null,
  uri: string
): ResolvedURI {
  const url = new URL(uri)
  if (url.protocol === 'git:') {
    return {
      repo: (url.host + url.pathname).replace(/^\/*/, ''),
      rev: url.search.slice(1),
      path: url.hash.slice(1),
    }
  }
  if (url.protocol === 'file:') {
    if (!base) {
      throw new Error(`unable to resolve URI ${uri} with no base`)
    }
    return { ...base, path: url.pathname }
  }
  throw new Error(
    `unrecognized URI: ${JSON.stringify(
      uri
    )} (supported URI schemes: git, file)`
  )
}
