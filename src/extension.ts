import { Settings, resolveSettings, resolveEndpoint, Location, Endpoint, Service } from './settings'
import * as sourcegraph from 'sourcegraph'
import {
    getFileCoverageRatios,
    getCommitCoverageRatio,
    getFileLineCoverage,
} from './model'
import { codecovToDecorations } from './decoration'
import { resolveURI, codecovParamsForRepositoryCommit } from './uri'

/** Entrypoint for the Codecov Sourcegraph extension. */
export function activate(): void {
    function activeEditors(): sourcegraph.CodeEditor[] {
        return sourcegraph.app.activeWindow
            ? sourcegraph.app.activeWindow.visibleViewComponents
            : []
    }

    // When the configuration or current file changes, publish new decorations.
    //
    // TODO: Unpublish decorations on previously (but not currently) open files when settings changes, to avoid a
    // brief flicker of the old state when the file is reopened.
    async function decorate(editors = activeEditors()): Promise<void> {
        const settings = resolveSettings(
            sourcegraph.configuration.get<Settings>().value
        )
        try {
            for (const editor of editors) {
                const decorations = await getFileLineCoverage(
                    resolveURI(editor.document.uri),
                    settings['codecov.endpoints'][0]
                )
                editor.setDecorations(
                    null,
                    codecovToDecorations(settings, decorations)
                )
            }
        } catch (err) {
            console.error('Decoration error:', err)
        }
    }
    sourcegraph.configuration.subscribe(() => decorate())
    // TODO(sqs): Add a way to get notified when a new editor is opened (because we want to be able to pass an `editor` to `updateDecorations`/`updateContext`, but this subscription just gives us a `doc`).
    sourcegraph.workspace.onDidOpenTextDocument.subscribe(() => decorate())

    // Set context values referenced in template expressions in the extension manifest (e.g., to interpolate "N" in
    // the "Coverage: N%" button label).
    //
    // The context only needs to be updated when the endpoints configuration changes.
    async function updateContext(editors = activeEditors()): Promise<void> {
        // Get the current repository. Sourcegraph 3.0-preview exposes sourcegraph.workspace.roots, but earlier
        // versions do not.
        let uri: string
        if (
            sourcegraph.workspace.roots &&
            sourcegraph.workspace.roots.length > 0
        ) {
            uri = sourcegraph.workspace.roots[0].uri.toString()
        } else if (editors.length > 0) {
            uri = editors[0].document.uri
        } else {
            return
        }
        const lastURI = resolveURI(uri)
        const endpoint = resolveEndpoint(
            sourcegraph.configuration.get<Settings>().get('codecov.endpoints')
        )

        const context: {
            [key: string]: string | number | boolean | null
        } = {}

        const p = codecovParamsForRepositoryCommit(lastURI)
        const repoURL = `${p.baseURL || 'https://codecov.io'}/${p.service}/${p.owner}/${p.repo}`
        context['codecov.repoURL'] = repoURL
        const baseFileURL = `${repoURL}/src/${p.sha}`
        context['codecov.commitURL'] = `${repoURL}/commit/${p.sha}`

        try {
            // Store overall commit coverage ratio.
            const commitCoverage = await getCommitCoverageRatio(
                lastURI,
                endpoint
            )
            context['codecov.commitCoverage'] = commitCoverage
                ? commitCoverage.toFixed(1)
                : null

            // Store coverage ratio (and Codecov report URL) for each file at this commit so that
            // template strings in contributions can refer to these values.
            const fileRatios = await getFileCoverageRatios(lastURI, endpoint)
            for (const [path, ratio] of Object.entries(fileRatios)) {
                const uri = `git://${lastURI.repo}?${lastURI.rev}#${path}`
                context[`codecov.coverageRatio.${uri}`] = ratio.toFixed(0)
                context[`codecov.fileURL.${uri}`] = `${baseFileURL}/${path}`
            }
        } catch (err) {
            console.error(`Error loading Codecov file coverage: ${err}`)
        }
        sourcegraph.internal.updateContext(context)
    }
    sourcegraph.configuration.subscribe(() => updateContext())
    sourcegraph.workspace.onDidOpenTextDocument.subscribe(() => updateContext())
    if (sourcegraph.workspace.onDidChangeRoots) {
        sourcegraph.workspace.onDidChangeRoots.subscribe(() => updateContext())
    }


    sourcegraph.commands.registerCommand('codecov.setupEnterprise', async () => {
        const endpoint = resolveEndpoint(
            sourcegraph.configuration.get<Settings>().get('codecov.endpoints')
        )
        if (!sourcegraph.app.activeWindow) {
            throw new Error(
                'To set a Codecov Endpoint, navigate to a file and then re-run this command.'
            )
        }

        const service = await sourcegraph.app.activeWindow.showInputBox({
            prompt: `Version control type (gh/ghe/bb/gl):`,
            value: endpoint.service || '',
        })

        const url = await sourcegraph.app.activeWindow.showInputBox({
            prompt: `Codecov endpoint:`,
            value: endpoint.url || '',
        })

        if (url !== undefined && service !== undefined) {
            // TODO: Only supports setting the token of the first API endpoint.
            return sourcegraph.configuration
                .get<Settings>()
                .update('codecov.endpoints', [
                    { ...endpoint, url, service },
                ])
        }
    })

    // Handle the "Set Codecov API token" command (show the user a prompt for their token, and save
    // their input to settings).
    sourcegraph.commands.registerCommand('codecov.setAPIToken', async () => {
        const endpoint = resolveEndpoint(
            sourcegraph.configuration.get<Settings>().get('codecov.endpoints')
        )

        if (!sourcegraph.app.activeWindow) {
            throw new Error(
                'To set a Codecov API token, navigate to a file and then re-run this command.'
            )
        }

        const token = await sourcegraph.app.activeWindow.showInputBox({
            prompt: `Codecov API token (for ${endpoint.url}):`,
            value: endpoint.token || undefined,
        })

        if (token !== undefined) {
            // TODO: Only supports setting the token of the first API endpoint.
            return sourcegraph.configuration
                .get<Settings>()
                .update('codecov.endpoints', [
                    { ...endpoint, token },
                ])
        }
    })
}
