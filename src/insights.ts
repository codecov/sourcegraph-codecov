import { combineLatest, concat } from 'rxjs'
import { map } from 'rxjs/operators'
import * as sourcegraph from 'sourcegraph'
import { getCommitCoverage, getGraphSVG, getTreeCoverage } from './api'
import { codecovParamsForRepositoryCommit, resolveDocumentURI } from './uri'

/**
 * Returns a view provider that shows a coverage graph on directory pages using the experimental view provider API.
 */
export const createGraphViewProvider = (
    graphType: 'icicle' | 'sunburst' | 'tree' | 'pie'
): sourcegraph.DirectoryViewProvider => ({
    where: 'directory',
    provideView: ({ workspace, viewer }) => {
        const { repo, rev, path } = resolveDocumentURI(viewer.directory.uri.href)
        const apiParams = codecovParamsForRepositoryCommit({ repo, rev }, sourcegraph)

        return combineLatest([
            // coverage
            concat([null], path ? getTreeCoverage({ ...apiParams, path }) : getCommitCoverage(apiParams)),

            // svg
            concat(
                [null],
                (async () => {
                    // Codecov native SVG graphs are not available for subdirectories
                    if (path || (graphType !== 'icicle' && graphType !== 'sunburst' && graphType !== 'tree')) {
                        return null
                    }
                    // Try to get graph SVG
                    // Fallback to default branch if commit is not available
                    // TODO: Extension API should expose the rev instead
                    // https://github.com/sourcegraph/sourcegraph/issues/4278
                    return (
                        (await getGraphSVG({ ...apiParams, graphType })) ||
                        (await getGraphSVG({
                            ...apiParams,
                            sha: undefined,
                            graphType,
                        }))
                    )
                })()
            ),
        ]).pipe(
            map(([coverage, svg]) => {
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

                const coverageRatio =
                    coverage &&
                    ('folder_totals' in coverage.commit
                        ? parseFloat(coverage.commit.folder_totals.coverage)
                        : coverage.commit.totals.coverage)

                let title = 'Test coverage'
                if (coverageRatio !== null && graphType !== 'pie') {
                    title += `: ${coverageRatio.toFixed(0)}%`
                }

                const content: (
                    | sourcegraph.MarkupContent
                    | sourcegraph.PieChartContent<{ name: string; value: number; fill: string }>
                )[] =
                    graphType === 'pie' && coverageRatio !== null
                        ? [
                              {
                                  kind: sourcegraph.MarkupKind.Markdown,
                                  value: 'Percentages of lines of code that are covered/not covered by tests.',
                              },
                              {
                                  chart: 'pie',
                                  pies: [
                                      {
                                          data: [
                                              {
                                                  name: 'Not covered',
                                                  value: 100 - coverageRatio,
                                                  fill: 'var(--danger)',
                                              },
                                              {
                                                  name: 'Covered',
                                                  value: coverageRatio,
                                                  fill: 'var(--success)',
                                              },
                                          ],
                                          dataKey: 'value',
                                          nameKey: 'name',
                                          fillKey: 'fill',
                                      },
                                  ],
                              },
                          ]
                        : svg
                        ? [
                              {
                                  kind: sourcegraph.MarkupKind.Markdown,
                                  value: 'Distribution of test coverage across the codebase.\n' + svg,
                              },
                          ]
                        : []

                return { title, content }
            })
        )
    },
})

function prepareSVG(svg: string, repoLink: URL): string {
    // Always link to tree pages.
    // We cannot determine if the path is a file or directory,
    // but Sourcegraph will redirect if necessary.
    const baseLink = repoLink.href + '/-/tree'

    // Regex XML parsing is bad, but DOMParser is not available in Workers
    // and we know the structure of the SVG
    return (
        svg
            // Make SVG responsive
            .replace(/width="\d+"/, 'width="100%" style="flex: 1 1 0"')
            .replace(/height="\d+"/, '')
            // Remove weird double-slashes
            .replace(/\/\//g, '/')
            // Remove <title> and replace with data-tooltip used in Sourcegraph webapp
            .replace(/<title>[^<]*<\/title>/g, '')
            // Make borders react to dark theme
            .replace(/stroke="white"/g, 'stroke="var(--body-bg)"')
            // Link to directories
            .replace(
                /^<rect (.+)data-content="(\/[^"]*)"(.+)<\/rect>$/gm,
                `<a href="${baseLink}$2" data-tooltip="$2"><rect $1$3</rect></a>`
            )
            // Make sure line breaks are not interpreted as markdown line breaks
            .replace(/\n/g, ' ')
    )
}
