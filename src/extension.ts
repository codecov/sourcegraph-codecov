import { createWebWorkerMessageTransports } from 'sourcegraph/module/jsonrpc2/transports/webWorker'
import { SourcegraphExtensionAPI, activateExtension } from 'sourcegraph'
import { Settings, resolveSettings, resolveEndpoint } from './settings'
import { combineLatest, from, ObservableInput } from 'rxjs'
import {
    getFileCoverageRatios,
    getCommitCoverageRatio,
    getFileLineCoverage,
} from './model'
import { codecovToDecorations } from './decoration'
import { resolveURI, codecovParamsForRepositoryCommit } from './uri'
import { Window } from 'sourcegraph/lib/extension/api'

/** Entrypoint for the Codecov Sourcegraph extension. */
export function run(sourcegraph: SourcegraphExtensionAPI<Settings>): void {
    // When the configuration or current file changes, publish new decorations.
    //
    // TODO: Unpublish decorations on previously (but not currently) open files when settings changes, to avoid a
    // brief flicker of the old state when the file is reopened.
    combineLatest(
        from(sourcegraph.configuration as ObservableInput<Settings>),
        from(sourcegraph.windows as ObservableInput<Window[]>)
    ).subscribe(async ([configuration, windows]) => {
        for (const window of windows) {
            // Publish the latest decorations for the file that's being displayed in the window, if any.
            if (window.activeComponent && window.activeComponent.resource) {
                const settings = resolveSettings(configuration)
                const uri = window.activeComponent.resource
                sourcegraph.windows.setDecorations(
                    { uri },
                    codecovToDecorations(
                        settings,
                        await getFileLineCoverage(
                            resolveURI(uri),
                            settings['codecov.endpoints'][0]
                        )
                    )
                )
            }
        }
    })

    // Set context values referenced in template expressions in the extension manifest (e.g., to interpolate "N" in
    // the "Coverage: N%" button label).
    //
    // The context only needs to be updated when the endpoints configuration changes.
    combineLatest(
        from(sourcegraph.configuration.watch(
            'codecov.endpoints'
        ) as ObservableInput<Settings>),
        from(sourcegraph.windows as ObservableInput<Window[]>)
    ).subscribe(async ([configuration, windows]) => {
        if (
            !sourcegraph.activeWindow ||
            !sourcegraph.activeWindow.activeComponent ||
            !sourcegraph.activeWindow.activeComponent.resource
        ) {
            return
        }
        const lastURI = resolveURI(
            sourcegraph.activeWindow.activeComponent.resource
        )

        const endpoint = resolveEndpoint(configuration['codecov.endpoints'])

        const context: {
            [key: string]: string | number | boolean | null
        } = {}

        const p = codecovParamsForRepositoryCommit(lastURI)
        // TODO Support non-codecov.io endpoints.
        const repoURL = `https://codecov.io/${p.service}/${p.owner}/${p.repo}`
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
        sourcegraph.context.updateContext(context)
    })

    // Handle the "Set Codecov API token" command (show the user a prompt for their token, and save
    // their input to settings).
    sourcegraph.commands.register('codecov.setAPIToken', async () => {
        const endpoint = resolveEndpoint(
            sourcegraph.configuration.get('codecov.endpoints')
        )
        const token = await sourcegraph.windows.showInputBox(
            `Codecov API token (for ${endpoint.url}):`,
            endpoint.token || ''
        )
        if (token !== null) {
            // TODO: Only supports setting the token of the first API endpoint.
            endpoint.token = token || undefined
            return sourcegraph.configuration.update('codecov.endpoints', [
                endpoint,
            ])
        }
    })
}

// This runs in a Web Worker and communicates using postMessage with the page.
activateExtension<Settings>(
    createWebWorkerMessageTransports(self as DedicatedWorkerGlobalScope),
    run
)
