import { distinctUntilChanged, map, switchMap } from 'rxjs/operators'
import * as sourcegraph from 'sourcegraph'
import { getCommitCoverage, getGraphSVG, getTreeCoverage } from './api'
import { configurationChanges } from './settings'
import { codecovParamsForRepositoryCommit, resolveDocumentURI } from './uri'

/**
 * Shows the coverage graph on directory pages using the experimental view provider API.
 */
export const graphViewProvider: sourcegraph.DirectoryViewProvider = {
    where: 'directory',
    provideView: ({ workspace, viewer }) =>
        configurationChanges.pipe(
            map(settings => settings['codecov.graphType']),
            distinctUntilChanged(),
            switchMap(async graphType => {
                const { repo, rev, path } = resolveDocumentURI(viewer.directory.uri.href)
                if (!graphType) {
                    return null
                }
                const apiParams = codecovParamsForRepositoryCommit({ repo, rev }, sourcegraph)
                const coverage = path
                    ? await getTreeCoverage({ ...apiParams, path })
                    : await getCommitCoverage(apiParams)

                // Try to get graph SVG
                let svg: string | null = null
                if (!path) {
                    svg = await getGraphSVG({ ...apiParams, graphType })
                    if (!svg) {
                        // Fallback to default branch if commit is not available
                        // TODO: Extension API should expose the rev instead
                        // https://github.com/sourcegraph/sourcegraph/issues/4278
                        svg = await getGraphSVG({
                            ...apiParams,
                            sha: undefined,
                            graphType,
                        })
                    }
                }

                if (!svg && coverage === null) {
                    // We don't have anything to show
                    return null
                }

                if (svg) {
                    const repoLink = new URL(
                        `${workspace.uri.hostname}${workspace.uri.pathname}@${rev}`,
                        sourcegraph.internal.sourcegraphURL
                    )
                    svg = prepareSVG(svg, repoLink)
                }

                let title = 'Coverage'
                if (coverage !== null) {
                    const coverageRatio =
                        'folder_totals' in coverage.commit
                            ? parseFloat(coverage.commit.folder_totals.coverage)
                            : coverage.commit.totals.coverage

                    title += `: ${coverageRatio.toFixed(0)}%`
                }

                const content = svg ? [{ type: sourcegraph.MarkupKind.Markdown, value: svg }] : []

                return { title, content }
            })
        ),
}

function prepareSVG(svg: string, repoLink: URL): string {
    // Always link to tree pages.
    // We cannot determine if the path is a file or directory,
    // but Sourcegraph will redirect if necessary.
    const baseLink = repoLink.href + '/-/tree'

    // Regex XML parsing is bad, but DOMParser is not available in Workers
    // and we know the structure of the SVG
    return (
        svg
            // Make sure SVG stretches to full width
            .replace(/width="\d+"/, 'width="100%"')
            .replace(/\/\//g, '/')
            // Remove <title> and replace with data-tooltip used in Sourcegraph webapp
            .replace(/<title>[^<]*<\/title>/g, '')
            // Link to directories
            .replace(
                /^<rect (.+)data-content="(\/[^"]*)"(.+)<\/rect>$/gm,
                `<a href="${baseLink}$2" data-tooltip="$2"><rect $1$3</rect></a>`
            )
            // Make sure line breaks are not interpreted as markdown line breaks
            .replace(/\n/g, ' ')
    )
}
