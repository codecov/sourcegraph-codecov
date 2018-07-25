/** The user settings for this extension. */
export interface ExtensionSettings {
  /** Settings specifying what to display on files. */
  decorations?: DecorationSettings

  /** The Codecov API token (required for private repositories). */
  token?: string

  /**
   * NOT YET SUPPORTED: URL(s) to Codecov Enterprise instances to contact for coverage data. If not specified,
   * https://codecov.io is used.
   */
  endpoints?: string[]
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

/** Applies defaults and normalizes the user settings. */
export function resolveDecorationSettings(
  settings: ExtensionSettings
): DecorationSettings {
  if (!settings.decorations) {
    return { lineBackgroundColors: true }
  }
  if (settings.decorations.hide) {
    return { hide: true }
  }
  return {
    lineBackgroundColors: settings.decorations.lineBackgroundColors !== false, // default true
    lineHitCounts: !!settings.decorations.lineHitCounts, // default false
  }
}
