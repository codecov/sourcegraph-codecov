import { ParsedURI } from './model'

/**
 * Resolve a URI of the forms git://github.com/owner/repo?rev#path and file:///path to an absolute reference, using
 * the given base (root) URI.
 */
export function resolveURI(
  base: Pick<ParsedURI, 'repo' | 'rev'> | null,
  uri: string
): ParsedURI {
  const url = new URL(uri.replace(/^git:/, 'http:'))
  if (url.protocol === 'http:') {
    return {
      repo: url.host + url.pathname,
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
