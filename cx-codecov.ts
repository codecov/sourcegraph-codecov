import { createWebWorkerMessageTransports } from 'cxp/module/jsonrpc2/transports/webWorker'
import { InitializeResult, InitializeParams } from 'cxp/module/protocol'
import {
  TextDocumentDecoration,
  ExecuteCommandParams,
  ConfigurationUpdateRequest,
  ConfigurationUpdateParams,
  Contributions,
  DidChangeConfigurationParams,
  RegistrationRequest,
  RegistrationParams,
  TextDocumentPublishDecorationsNotification,
  TextDocumentPublishDecorationsParams,
} from 'cxp'
import { Connection, createConnection } from 'cxp/module/server/server'
import { TextDocuments } from 'cxp/module/server/features/textDocumentSync'
import { isEqual } from 'cxp/module/util'
import { TextDocument } from 'vscode-languageserver-types'

const TOGGLE_COMMAND_ID = 'codecov.toggle'

/** The user settings for this extension. */
interface ExtensionSettings {
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
interface DecorationSettings {
  /** Hide all of the decorations. */
  hide?: boolean

  /** Whether to decorate lines with background colors based on their coverage. */
  lineBackgroundColors?: boolean

  /** Whether to decorate the end of the line with the hit/branch stats. */
  lineHitCounts?: boolean
}

function resolveDecorationSettings(
  settings: ExtensionSettings
): DecorationSettings {
  // Apply defaults.
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

interface ParsedURI {
  repo: string
  rev: string
  path: string
}

export function run(connection: Connection): void {
  let initialized = false
  let root: Pick<ParsedURI, 'repo' | 'rev'> | null = null
  let settings: ExtensionSettings | undefined
  let lastOpenedTextDocument: TextDocument | undefined

  const textDocuments = new TextDocuments()
  textDocuments.listen(connection)
  textDocuments.onDidOpen(({ document }) => (lastOpenedTextDocument = document))

  connection.onInitialize(
    (params: InitializeParams & { originalRootUri?: string }) => {
      if (initialized) {
        throw new Error('already initialized')
      }
      initialized = true

      // Use original root if proxied so we know which repository/revision this is for.
      const rootStr = params.originalRootUri || params.root || undefined
      if (rootStr) {
        root = resolveURI(null, rootStr)
      }

      return {
        capabilities: {
          textDocumentSync: {
            openClose: true,
          },
          executeCommandProvider: {
            commands: [TOGGLE_COMMAND_ID],
          },
          decorationProvider: { dynamic: true },
        },
      } as InitializeResult
    }
  )

  connection.onDidChangeConfiguration(
    async (params: DidChangeConfigurationParams) => {
      const newSettings: ExtensionSettings = params.settings.merged // merged is (global + org + user) settings
      if (isEqual(settings, newSettings)) {
        return // nothing to do
      }
      settings = newSettings
      // Don't bother updating client view state if there is no document yet.
      if (lastOpenedTextDocument) {
        await registerContributions(newSettings)
        await publishDecorations(newSettings, textDocuments.all())
      }
    }
  )

  textDocuments.onDidOpen(async ({ document }) => {
    if (settings) {
      await registerContributions(settings)
      await publishDecorations(settings, [document])
    }
  })

  connection.onExecuteCommand((params: ExecuteCommandParams) => {
    switch (params.command) {
      case TOGGLE_COMMAND_ID:
        if (!settings) {
          throw new Error('settings are not yet available')
        }
        if (!settings.decorations) {
          settings.decorations = {}
        }
        settings.decorations.hide = settings.decorations.hide ? undefined : true

        // Run async to avoid blocking our response (and leading to a deadlock).
        connection
          .sendRequest(ConfigurationUpdateRequest.type, {
            path: ['decorations', 'hide'],
            value: settings.decorations.hide,
          } as ConfigurationUpdateParams)
          .catch(err => console.error('configuration/update:', err))
        registerContributions(settings).catch(err =>
          console.error('registerContributions:', err)
        )
        publishDecorations(settings, textDocuments.all()).catch(err =>
          console.error('publishDecorations:', err)
        )
        break

      default:
        throw new Error(`unknown command: ${params.command}`)
    }
  })

  let registeredContributions = false
  async function registerContributions(
    settings: ExtensionSettings
  ): Promise<void> {
    const contributions: Contributions = {}
    if (lastOpenedTextDocument) {
      const fileCoverage = await getCoverageForFile({
        token: settings.token,
        ...resolveURI(root, lastOpenedTextDocument.uri),
      })
      contributions.commands = [
        {
          command: TOGGLE_COMMAND_ID,
          title: fileCoverage.ratio
            ? `Coverage: ${parseFloat(fileCoverage.ratio).toFixed(0)}%`
            : 'Coverage',
          detail: `Codecov: ${
            !settings.decorations || !settings.decorations.hide
              ? 'Hide'
              : 'Show'
          } code coverage`,
        },
      ]
      contributions.menus = {
        'editor/title': [{ command: TOGGLE_COMMAND_ID }],
      }
    }
    await connection.sendRequest(RegistrationRequest.type, {
      registrations: [
        {
          id: 'main',
          method: 'window/contribution',
          overwriteExisting: registeredContributions,
          registerOptions: contributions,
        },
      ],
    } as RegistrationParams)
    registeredContributions = true
  }

  async function publishDecorations(
    settings: ExtensionSettings,
    documents: TextDocument[]
  ): Promise<void> {
    for (const { uri } of documents) {
      connection.sendNotification(
        TextDocumentPublishDecorationsNotification.type,
        {
          textDocument: { uri },
          decorations: await getDecorations(root, settings, uri),
        } as TextDocumentPublishDecorationsParams
      )
    }
  }

  async function getDecorations(
    root: Pick<ParsedURI, 'repo' | 'rev'> | null,
    settings: ExtensionSettings,
    uri: string
  ): Promise<TextDocumentDecoration[]> {
    const { hide, ...decorationSettings } = resolveDecorationSettings(settings)
    if (hide) {
      return []
    }
    return codecovToDecorations(
      decorationSettings,
      await getCoverageForFile({
        token: settings.token,
        ...resolveURI(root, uri),
      })
    )
  }
}

/**
 * Resolve a URI of the forms git://github.com/owner/repo?rev#path and file:///path to an absolute reference, using
 * the given base (root) URI.
 */
function resolveURI(
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

interface FileCoverage {
  ratio?: string
  lines?: { [line: string]: LineCoverage }
}

type LineCoverage = number | { hits: number; branches: number }

const ALPHA = 0.25
const RED_HUE = 0
const YELLOW_HUE = 60
const GREEN_HUE = 116

function codecovToDecorations(
  settings: Pick<DecorationSettings, Exclude<keyof DecorationSettings, 'hide'>>,
  { lines }: FileCoverage
): TextDocumentDecoration[] {
  if (!lines) {
    return []
  }
  return Object.keys(lines).map(line => {
    const decoration: TextDocumentDecoration = {
      range: {
        start: { line: parseInt(line) - 1, character: 0 },
        end: { line: parseInt(line) - 1, character: 1 },
      },
      isWholeLine: true,
    }
    if (settings.lineBackgroundColors) {
      decoration.backgroundColor = lineColor(lines[line], 0.7, ALPHA)
    }
    if (settings.lineHitCounts) {
      decoration.after = {
        backgroundColor: lineColor(lines[line], 0.7, 1),
        color: lineColor(lines[line], 0.25, 1),
        ...lineText(lines[line]),
        linkURL: 'http://example.com', // TODO!(sqs)
      }
    }
    return decoration
  })
}

function lineColor(
  coverage: LineCoverage,
  lightness: number,
  alpha: number
): string {
  let hue: number
  if (coverage === 0 || coverage === null) {
    hue = RED_HUE
  } else if (
    typeof coverage === 'number' ||
    coverage.hits === coverage.branches
  ) {
    hue = GREEN_HUE
  } else {
    hue = YELLOW_HUE // partially covered
  }
  return `hsla(${hue}, 100%, ${lightness * 100}%, ${alpha})`
}

function lineText(
  coverage: LineCoverage
): { contentText?: string; hoverMessage?: string } {
  if (typeof coverage === 'number') {
    if (coverage >= 1) {
      return {
        contentText: ` ${coverage} `,
        hoverMessage: `${coverage} hit${coverage === 1 ? '' : 's'} (Codecov)`,
      }
    }
    return { hoverMessage: 'not covered by test (Codecov)' }
  }
  return {
    contentText: ` ${coverage.hits}/${coverage.branches} `,
    hoverMessage: `${coverage.hits}/${coverage.branches} branch${
      coverage.branches === 1 ? '' : 'es'
    } hit (Codecov)`,
  }
}

interface GetCoverageArgs extends ParsedURI {
  token: string | undefined
}

const getCoverageForFile = memoizeAsync(
  async ({
    token,
    repo,
    rev,
    path,
  }: GetCoverageArgs): Promise<FileCoverage> => {
    // TODO: support other code hosts
    const codeHost = 'gh'
    repo = repo.replace(/^github\.com\//, '')

    // TODO: support self-hosted codecov (not just codecov.io)
    //
    // TODO: remove this cors-anywhere proxy when codecov supports CORS
    const corsAnywhereURL = 'https://ca9911a.ngrok.io/'
    const resp = await fetch(
      `${corsAnywhereURL}https://codecov.io/api/${codeHost}/${repo}/commits/${rev}?src=extension`,
      {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        headers: token ? { Authorization: `token ${token}` } : undefined,
      }
    )
    const fileData = (await resp.json()).commit.report.files[path]
    return fileData ? asFileCoverage(fileData) : {}
  },
  ({ token, repo, rev, path }) => `${token}:${repo}:${rev}:${path}`
)

/** Mutates data to make it a FileCoverage. */
function asFileCoverage(data: {
  t: { c: string }
  l: {
    [line: string]: number | string
  }
}): FileCoverage {
  const coverage: FileCoverage = {
    ratio: data.t && data.t.c,
    lines: data.l as any,
  }
  for (const line of Object.keys(data.l)) {
    // We only need to parse strings; other types (number | null) can pass through unchanged.
    const value = data.l[line]
    if (typeof value === 'string') {
      const [hits, branches] = value.split('/', 2).map(v => parseInt(v, 10))
      coverage.lines![line] = { hits, branches }
    }
  }
  return coverage
}

/**
 * Creates a function that memoizes the async result of func. If the Promise is rejected, the result will not be
 * cached.
 *
 * @param resolver If resolver provided, it determines the cache key for storing the result based on the first
 * argument provided to the memoized function.
 */
function memoizeAsync<P, T>(
  func: (params: P) => Promise<T>,
  resolver?: (params: P) => string
): (params: P) => Promise<T> {
  const cache = new Map<string, Promise<T>>()
  return (params: P) => {
    const key = resolver ? resolver(params) : params.toString()
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

const connection = createConnection(
  createWebWorkerMessageTransports(self as DedicatedWorkerGlobalScope)
)
run(connection)
connection.listen()
