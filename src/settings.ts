/**
 * The resolved and normalized settings for this extension, the result of calling resolveSettings on a RawSettings
 * value.
 */
export interface Settings {
  /** Settings specifying what to display on files. */
  decorations: DecorationSettings

  /**
   * The list of Codecov endpoints that are contacted to retrieve coverage data, in order.
   *
   * If empty or not set, https://codecov.io is used.
   */
  endpoints: Endpoint[]
}

/** The raw settings for this extension. Most callers should use Settings instead. */
export interface RawSettings {
  decorations?: Settings['decorations']
  endpoints?: Settings['endpoints']
}

/** Returns a copy of the extension settings with values normalized and defaults applied. */
export function resolveSettings(raw: RawSettings): Settings {
  return {
    decorations: resolveDecorations(raw),
    endpoints: resolveEndpoints(raw),
  }
}

/** A Codecov endpoint (either https://codecov.io or Codecov Enterprise). */
export interface Endpoint {
  /**
   * The URL for this endpoint.
   * @example https://codecov.io (Codecov.io)
   * @example https://codecov.example.com (Codecov Enterprise)
   */
  url: string

  /** The Codecov API token for this endpoint (required for private repositories on Codecov.io). */
  token?: string
}

function resolveEndpoints(raw: RawSettings): Endpoint[] {
  if (!raw.endpoints || raw.endpoints.length === 0) {
    return [{ url: 'https://codecov.io' }]
  }
  return raw.endpoints.map(({ url, token }) => ({
    url: urlWithOnlyProtocolAndHost(url),
    token,
  }))
}

function urlWithOnlyProtocolAndHost(urlStr: string): string {
  const url = new URL(urlStr)
  return `${url.protocol}//${url.host}`
}

/**
 * The user settings for this extension's file decorations, in the "decorations" sub-property of the extension
 * settings.
 */
export interface DecorationSettings {
  /** Hide all of the decorations. */
  hide?: boolean

  /** Whether to decorate lines with background colors based on their coverage. */
  lineBackgroundColors?: boolean

  /** Whether to decorate the end of the line with the hit/branch stats. */
  lineHitCounts?: boolean
}

function resolveDecorations(raw: RawSettings): DecorationSettings {
  if (!raw.decorations) {
    return { lineBackgroundColors: true }
  }
  if (raw.decorations.hide) {
    return { hide: true }
  }
  return {
    lineBackgroundColors: raw.decorations.lineBackgroundColors !== false, // default true
    lineHitCounts: !!raw.decorations.lineHitCounts, // default false
  }
}
