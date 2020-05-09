import { combineLatest, from, Subscription } from 'rxjs'
import { concatMap, filter, map, startWith, switchMap, distinctUntilChanged } from 'rxjs/operators'
import * as sourcegraph from 'sourcegraph'
import { Service } from './api'
import { codecovToDecorations } from './decoration'
import { createGraphViewProvider } from './insights'
import { getCommitCoverageRatio, getFileCoverageRatios, getFileLineCoverage } from './model'
import { configurationChanges, Endpoint, resolveEndpoint, resolveSettings, Settings, InsightSettings } from './settings'
import { codecovParamsForRepositoryCommit, resolveDocumentURI, resolveRootURI } from './uri'

const decorationType = sourcegraph.app.createDecorationType && sourcegraph.app.createDecorationType()

/** Entrypoint for the Codecov Sourcegraph extension. */
export function activate(
    context: sourcegraph.ExtensionContext = {
        subscriptions: new Subscription(),
    }
): void {
    /**
     * An Observable that emits the active window's visible view components
     * when the active window or its view components change.
     */
    const editorsChanges = sourcegraph.app.activeWindowChanges
        ? from(sourcegraph.app.activeWindowChanges).pipe(
              filter(
                  (activeWindow): activeWindow is Exclude<typeof activeWindow, undefined> => activeWindow !== undefined
              ),
              switchMap(activeWindow =>
                  from(activeWindow.activeViewComponentChanges).pipe(map(() => activeWindow.visibleViewComponents))
              )
              // Backcompat: rely on onDidOpenTextDocument if the extension host doesn't support activeWindowChanges / activeViewComponentChanges
          )
        : from(sourcegraph.workspace.onDidOpenTextDocument).pipe(
              map(() => (sourcegraph.app.activeWindow && sourcegraph.app.activeWindow.visibleViewComponents) || [])
          )

    // When the configuration or current file changes, publish new decorations.
    //
    // TODO: Unpublish decorations on previously (but not currently) open files when settings changes, to avoid a
    // brief flicker of the old state when the file is reopened.
    async function decorate(settings: Readonly<Settings>, editors: sourcegraph.ViewComponent[]): Promise<void> {
        const resolvedSettings = resolveSettings(settings)
        for (const editor of editors) {
            if (editor.type !== 'CodeEditor') {
                continue
            }
            const decorations = await getFileLineCoverage(
                resolveDocumentURI(editor.document.uri),
                resolvedSettings['codecov.endpoints'][0],
                sourcegraph
            )
            if (!decorations) {
                continue
            }
            editor.setDecorations(decorationType, codecovToDecorations(settings, decorations))
        }
    }

    context.subscriptions.add(
        combineLatest([configurationChanges, editorsChanges])
            .pipe(
                concatMap(async ([settings, editors]) => {
                    try {
                        await decorate(settings, editors)
                    } catch (err) {
                        console.error('Codecov: decoration error', err)
                    }
                })
            )
            .subscribe()
    )

    // Set context values referenced in template expressions in the extension manifest (e.g., to interpolate "N" in
    // the "Coverage: N%" button label).
    //
    // The context only needs to be updated when the endpoints configuration changes.
    async function updateContext(
        endpoints: readonly Endpoint[] | undefined,
        roots: readonly sourcegraph.WorkspaceRoot[],
        editors: sourcegraph.ViewComponent[]
    ): Promise<void> {
        // Get the current repository. Sourcegraph 3.0-preview exposes sourcegraph.workspace.roots, but earlier
        // versions do not.
        let uri: string
        if (roots && roots.length > 0) {
            uri = roots[0].uri.toString()
        } else if (editors.length > 0) {
            const editor = editors[0]
            if (editor.type !== 'CodeEditor') {
                return
            }
            uri = editor.document.uri
        } else {
            return
        }
        const lastURI = resolveRootURI(uri)
        const endpoint = resolveEndpoint(endpoints)

        const context: {
            [key: string]: string | number | boolean | null
        } = {}

        const p = codecovParamsForRepositoryCommit(lastURI, sourcegraph)
        const repoURL = `${p.baseURL || 'https://codecov.io'}/${p.service}/${p.owner}/${p.repo}`
        context['codecov.repoURL'] = repoURL
        const baseFileURL = `${repoURL}/src/${p.sha}`
        context['codecov.commitURL'] = `${repoURL}/commit/${p.sha}`

        try {
            // Store overall commit coverage ratio.
            const commitCoverage = await getCommitCoverageRatio(lastURI, endpoint, sourcegraph)
            context['codecov.commitCoverage'] = commitCoverage ? commitCoverage.toFixed(1) : null

            // Store coverage ratio (and Codecov report URL) for each file at this commit so that
            // template strings in contributions can refer to these values.
            const fileRatios = await getFileCoverageRatios(lastURI, endpoint, sourcegraph)
            if (fileRatios) {
                for (const [path, ratio] of Object.entries(fileRatios)) {
                    const uri = `git://${lastURI.repo}?${lastURI.rev}#${path}`
                    context[`codecov.coverageRatio.${uri}`] = ratio.toFixed(0)
                    context[`codecov.fileURL.${uri}`] = `${baseFileURL}/${path}`
                }
            }
        } catch (err) {
            console.error('Error loading Codecov file coverage:', err)
        }
        sourcegraph.internal.updateContext(context)
    }

    // Update the context when the configuration, workspace roots or active editors change.
    context.subscriptions.add(
        combineLatest([
            configurationChanges.pipe(map(settings => settings['codecov.endpoints'])),
            from(
                // Backcompat: rely on onDidChangeRoots if the extension host doesn't support rootChanges.
                sourcegraph.workspace.rootChanges || sourcegraph.workspace.onDidChangeRoots
            ).pipe(
                map(() => sourcegraph.workspace.roots),
                startWith(sourcegraph.workspace.roots)
            ),
            editorsChanges,
        ])
            .pipe(
                concatMap(async ([endpoints, roots, editors]) => {
                    try {
                        await updateContext(endpoints, roots, editors)
                    } catch (err) {
                        console.error('Codecov: error updating context', err)
                    }
                })
            )
            .subscribe()
    )

    sourcegraph.commands.registerCommand('codecov.setupEnterprise', async () => {
        const endpoint = resolveEndpoint(sourcegraph.configuration.get<Settings>().get('codecov.endpoints'))
        if (!sourcegraph.app.activeWindow) {
            throw new Error('To set a Codecov Endpoint, navigate to a file and then re-run this command.')
        }

        const service = await sourcegraph.app.activeWindow.showInputBox({
            prompt: 'Version control type (gh/ghe/bb/gl):',
            value: endpoint.service || '',
        })

        const url = await sourcegraph.app.activeWindow.showInputBox({
            prompt: 'Codecov endpoint:',
            value: endpoint.url || '',
        })

        if (url !== undefined && service !== undefined) {
            // TODO: Only supports setting the token of the first API endpoint.
            return sourcegraph.configuration
                .get<Settings>()
                .update('codecov.endpoints', [{ ...endpoint, url, service: service as Service }])
        }
    })

    // Handle the "Set Codecov API token" command (show the user a prompt for their token, and save
    // their input to settings).
    sourcegraph.commands.registerCommand('codecov.setAPIToken', async () => {
        const endpoint = resolveEndpoint(sourcegraph.configuration.get<Settings>().get('codecov.endpoints'))

        if (!sourcegraph.app.activeWindow) {
            throw new Error('To set a Codecov API token, navigate to a file and then re-run this command.')
        }

        const token = await sourcegraph.app.activeWindow.showInputBox({
            prompt: `Codecov API token (for ${endpoint.url}):`,
            value: endpoint.token || undefined,
        })

        if (token !== undefined) {
            // TODO: Only supports setting the token of the first API endpoint.
            return sourcegraph.configuration.get<Settings>().update('codecov.endpoints', [{ ...endpoint, token }])
        }
    })

    // Experimental: Show graphs on repository pages
    if (sourcegraph.app.registerViewProvider) {
        const graphTypes: ['icicle', 'sunburst', 'tree', 'pie'] = ['icicle', 'sunburst', 'tree', 'pie']
        for (const graphType of graphTypes) {
            let subscription: sourcegraph.Unsubscribable = new Subscription()
            context.subscriptions.add(
                configurationChanges
                    .pipe(
                        map((settings): boolean => settings[`codecov.insight.${graphType}` as keyof InsightSettings]),
                        distinctUntilChanged()
                    )
                    .subscribe(enabled => {
                        if (enabled) {
                            subscription = sourcegraph.app.registerViewProvider(
                                `codecov.${graphType}`,
                                createGraphViewProvider(graphType)
                            )
                            context.subscriptions.add(subscription)
                        } else {
                            subscription.unsubscribe()
                        }
                    })
            )
        }
    }
}
