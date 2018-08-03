import { createWebWorkerMessageTransports } from 'cxp/module/jsonrpc2/transports/webWorker'
import {
    InitializeResult,
    InitializeParams,
} from 'cxp/module/protocol'
import {
    TextDocumentDecoration,
    ExecuteCommandParams,
    ConfigurationUpdateRequest,
    MenuItemContribution,
    ConfigurationUpdateParams,
    CommandContribution,
    Contributions,
    DidChangeConfigurationParams,
    RegistrationRequest,
    RegistrationParams,
    TextDocumentPublishDecorationsNotification,
    TextDocumentPublishDecorationsParams,
} from 'cxp/lib'
import { Connection, createConnection } from 'cxp/module/server/server'
import { TextDocuments } from 'cxp/module/server/features/textDocumentSync'
import { isEqual } from 'cxp/module/util'
import { TextDocument } from 'vscode-languageserver-types/lib/umd/main'
import { iconURL } from './icon'
import { Settings, resolveSettings } from './settings'
import { Model } from './model'
import { codecovToDecorations } from './decoration'
import { hsla, GREEN_HUE, RED_HUE } from './colors'
import { resolveURI, ResolvedURI } from './uri'

const TOGGLE_ALL_DECORATIONS_COMMAND_ID = 'codecov.decorations.toggleAll'
const TOGGLE_HITS_DECORATIONS_COMMAND_ID = 'codecov.decorations.hits.toggle'
const VIEW_COVERAGE_DETAILS_COMMAND_ID = 'codecov.viewCoverageDetails'
const SET_API_TOKEN_COMMAND_ID = 'codecov.setAPIToken'
const HELP_COMMAND_ID = 'codecov.help'

export function run(connection: Connection): void {
    let initialized = false
    let root: Pick<ResolvedURI, 'repo' | 'rev'> | null = null
    let settings: Settings | undefined
    let lastOpenedTextDocument: TextDocument | undefined

    // Track the currently open document.
    const textDocuments = new TextDocuments()
    textDocuments.listen(connection)
    textDocuments.onDidOpen(
        ({ document }) => (lastOpenedTextDocument = document)
    )
    textDocuments.onDidClose(({ document }) => {
        if (
            lastOpenedTextDocument &&
            lastOpenedTextDocument.uri === document.uri
        ) {
            lastOpenedTextDocument = undefined
        }
    })

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
                        commands: [
                            TOGGLE_ALL_DECORATIONS_COMMAND_ID,
                            TOGGLE_HITS_DECORATIONS_COMMAND_ID,
                        ],
                    },
                    decorationProvider: { dynamic: true },
                },
            } as InitializeResult
        }
    )

    connection.onDidChangeConfiguration(
        async (params: DidChangeConfigurationParams) => {
            const newSettings: Settings = resolveSettings(
                params.settings.merged
            ) // merged is (global + org + user) settings
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
    textDocuments.onDidClose(async ({ document }) => {
        if (settings) {
            // TODO!(sqs): wait to clear to avoid jitter, but we do need to eventually clear to avoid
            // showing this on non-files (such as dirs), until we get true 'when' support.
            setTimeout(() => {
                if (!lastOpenedTextDocument) {
                    registerContributions(settings!)
                }
            })
        }
    })

    connection.onExecuteCommand((params: ExecuteCommandParams) => {
        const executeConfigurationCommand = (
            newSettings: Settings,
            configParams: ConfigurationUpdateParams
        ) => {
            // Run async to avoid blocking our response (and leading to a deadlock).
            connection
                .sendRequest(ConfigurationUpdateRequest.type, configParams)
                .catch(err => console.error('configuration/update:', err))
            registerContributions(newSettings).catch(err =>
                console.error('registerContributions:', err)
            )
            publishDecorations(newSettings, textDocuments.all()).catch(err =>
                console.error('publishDecorations:', err)
            )
        }

        switch (params.command) {
            case TOGGLE_ALL_DECORATIONS_COMMAND_ID:
            case TOGGLE_HITS_DECORATIONS_COMMAND_ID:
                if (!settings) {
                    throw new Error('settings are not yet available')
                }
                if (!settings['codecov.decorations']) {
                    settings['codecov.decorations'] = {}
                }
                switch (params.command) {
                    case TOGGLE_ALL_DECORATIONS_COMMAND_ID:
                        settings['codecov.decorations'].hide = settings[
                            'codecov.decorations'
                        ].hide
                            ? undefined
                            : true
                        executeConfigurationCommand(settings, {
                            path: ['codecov.decorations', 'hide'],
                            value: settings['codecov.decorations'].hide,
                        })
                        break
                    case TOGGLE_HITS_DECORATIONS_COMMAND_ID:
                        settings[
                            'codecov.decorations'
                        ].lineHitCounts = !settings['codecov.decorations']
                            .lineHitCounts
                        executeConfigurationCommand(settings, {
                            path: ['codecov.decorations', 'lineHitCounts'],
                            value:
                                settings['codecov.decorations'].lineHitCounts,
                        })
                        break
                }
                break

            default:
                throw new Error(`unknown command: ${params.command}`)
        }
    })

    let registeredContributions = false
    async function registerContributions(settings: Settings): Promise<void> {
        const contributions: Contributions = {
            commands: [],
            menus: { 'editor/title': [], commandPalette: [], help: [] },
        }
        if (lastOpenedTextDocument) {
            const ratio = await Model.getFileCoverageRatio(
                resolveURI(root, lastOpenedTextDocument.uri),
                settings
            )
            contributions.commands!.push({
                command: TOGGLE_ALL_DECORATIONS_COMMAND_ID,
                title: `${
                    settings['codecov.decorations'].hide ? 'Show' : 'Hide'
                } inline code coverage decorations on file`,
                category: 'Codecov',
                toolbarItem: {
                    label: ratio
                        ? `Coverage: ${ratio.toFixed(0)}%`
                        : 'Coverage',
                    description: `Codecov: ${
                        !settings['codecov.decorations'] ||
                        !settings['codecov.decorations'].hide
                            ? 'Hide'
                            : 'Show'
                    } code coverage`,
                    iconURL:
                        ratio !== undefined
                            ? iconURL(iconColor(ratio))
                            : undefined,
                    iconDescription:
                        'Codecov logo with red, yellow, or green color indicating the file coverage ratio',
                },
            })
            const menuItem: MenuItemContribution = {
                command: TOGGLE_ALL_DECORATIONS_COMMAND_ID,
            }
            contributions.menus!['editor/title']!.push(menuItem)
            contributions.menus!['commandPalette']!.push(menuItem)
        }

        // Always add global commands.
        const globalCommands: {
            command: CommandContribution
            menuItem: MenuItemContribution
        }[] = [
            {
                command: {
                    command: TOGGLE_HITS_DECORATIONS_COMMAND_ID,
                    title: 'Toggle line hit/branch counts',
                    category: 'Codecov',
                },
                menuItem: { command: TOGGLE_HITS_DECORATIONS_COMMAND_ID },
            },
            {
                command: {
                    command: VIEW_COVERAGE_DETAILS_COMMAND_ID,
                    title: 'View coverage details',
                    category: 'Codecov',
                },
                menuItem: { command: VIEW_COVERAGE_DETAILS_COMMAND_ID },
            },
            {
                command: {
                    command: SET_API_TOKEN_COMMAND_ID,
                    title: 'Set API token for private repositories...',
                    category: 'Codecov',
                },
                menuItem: { command: SET_API_TOKEN_COMMAND_ID },
            },
        ]
        for (const { command, menuItem } of globalCommands) {
            contributions.commands!.push(command)
            contributions.menus!['commandPalette']!.push(menuItem)
        }

        contributions.commands!.push({
            command: HELP_COMMAND_ID,
            title: 'Documentation and support',
            category: 'Codecov',
            iconURL: iconURL(),
        })
        contributions.menus!['help']!.push({ command: HELP_COMMAND_ID })

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
        settings: Settings,
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
        root: Pick<ResolvedURI, 'repo' | 'rev'> | null,
        settings: Settings,
        uri: string
    ): Promise<TextDocumentDecoration[]> {
        const { hide, ...decorationSettings } = settings['codecov.decorations']
        if (hide) {
            return []
        }
        return codecovToDecorations(
            decorationSettings,
            await Model.getFileLineCoverage(resolveURI(root, uri), settings)
        )
    }
}

function iconColor(coverageRatio: number): string {
    return hsla(coverageRatio * ((GREEN_HUE - RED_HUE) / 100), 0.25, 1)
}

const connection = createConnection(
    createWebWorkerMessageTransports(self as DedicatedWorkerGlobalScope)
)
run(connection)
connection.listen()
