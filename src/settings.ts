/**
 * The resolved and normalized settings for this extension, the result of calling resolveSettings on a raw settings
 * value.
 *
 * See the configuration JSON Schema in extension.json for the canonical documentation on these properties.
 */
export interface Settings {
    ['codecov.showCoverage']: boolean
    ['codecov.decorations.lineCoverage']: boolean
    ['codecov.decorations.lineHitCounts']: boolean
    ['codecov.endpoints']: Endpoint[]
}

/** Returns a copy of the extension settings with values normalized and defaults applied. */
export function resolveSettings(raw: Partial<Settings>): Settings {
    return {
        ['codecov.showCoverage']: raw['codecov.showCoverage'] !== false,
        ['codecov.decorations.lineCoverage']: !!raw[
            'codecov.decorations.lineCoverage'
        ],
        ['codecov.decorations.lineHitCounts']: !!raw[
            'codecov.decorations.lineHitCounts'
        ],
        ['codecov.endpoints']: [resolveEndpoint(raw['codecov.endpoints'])]
    }
}

export interface Endpoint {
    url: string
    token?: string
    service?: string
}

const CODECOV_IO_URL = 'https://codecov.io'

/**
 * Returns the configured endpoint with values normalized and defaults applied.
 *
 * @todo support more than 1 endpoint
 */
export function resolveEndpoint(
    endpoints?: Readonly<Endpoint[]>
): Readonly<Endpoint> {
    if (!endpoints || endpoints.length === 0) {
        return { url: CODECOV_IO_URL }
    }
    return {
        url: endpoints[0].url
            ? urlWithOnlyProtocolAndHost(endpoints[0].url)
            : CODECOV_IO_URL,
        token: endpoints[0].token || undefined,
        service: endpoints[0].service || undefined
    }
}

function urlWithOnlyProtocolAndHost(urlStr: string): string {
    const url = new URL(urlStr)
    return `${url.protocol}//${url.host}`
}
