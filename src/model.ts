import { CodecovCommitData, codecovGetCommitCoverage } from './api'
import { Endpoint } from './settings'
import {
    codecovParamsForRepositoryCommit,
    ResolvedDocumentURI,
    ResolvedRootURI,
} from './uri'

export interface FileLineCoverage {
    [line: string]: LineCoverage
}

export type LineCoverage = number | { hits: number; branches: number } | null

/** Gets the coverage ratio for a commit. */
export async function getCommitCoverageRatio(
    { repo, rev }: Pick<ResolvedRootURI, 'repo' | 'rev'>,
    endpoint: Endpoint,
    sourcegraph: typeof import('sourcegraph')
): Promise<number | null | undefined> {
    const data = await codecovGetCommitCoverage({
        ...codecovParamsForRepositoryCommit({ repo, rev }, sourcegraph),
        baseURL: endpoint.url,
        token: endpoint.token,
    })

    if (data.commit && data.commit.totals && data.commit.totals.coverage) {
        return data.commit.totals.coverage
    } else {
        return null
    }
}

/** Gets line coverage data for a file at a given commit in a repository. */
export async function getFileLineCoverage(
    { repo, rev, path }: ResolvedDocumentURI,
    endpoint: Endpoint,
    sourcegraph: typeof import('sourcegraph')
): Promise<FileLineCoverage> {
    const data = await codecovGetCommitCoverage({
        ...codecovParamsForRepositoryCommit({ repo, rev }, sourcegraph),
        baseURL: endpoint.url,
        token: endpoint.token,
    })
    return toLineCoverage(data, path)
}

/** Gets the file coverage ratios for all files at a given commit in a repository. */
export async function getFileCoverageRatios(
    { repo, rev }: Pick<ResolvedRootURI, 'repo' | 'rev'>,
    endpoint: Endpoint,
    sourcegraph: typeof import('sourcegraph')
): Promise<{ [path: string]: number }> {
    const data = await codecovGetCommitCoverage({
        ...codecovParamsForRepositoryCommit({ repo, rev }, sourcegraph),
        baseURL: endpoint.url,
        token: endpoint.token,
    })
    const ratios: { [path: string]: number } = {}
    for (const [path, fileData] of Object.entries(data.commit.report.files)) {
        const ratio = toCoverageRatio(fileData)
        if (ratio !== undefined) {
            ratios[path] = ratio
        }
    }
    return ratios
}

function toLineCoverage(
    data: CodecovCommitData,
    path: string
): FileLineCoverage {
    const result: FileLineCoverage = {}
    const fileData = data.commit.report.files[path]
    if (fileData) {
        for (const [lineStr, value] of Object.entries(fileData.l)) {
            const line = parseInt(lineStr, 10)
            if (typeof value === 'number' || value === null) {
                result[line] = value
            } else if (typeof value === 'string') {
                const [hits, branches] = value
                    .split('/', 2)
                    .map(v => parseInt(v, 10))
                result[line] = { hits, branches }
            }
        }
    }
    return result
}

function toCoverageRatio(
    fileData: CodecovCommitData['commit']['report']['files'][string]
): number | undefined {
    const ratioStr = fileData && fileData.t.c
    if (!ratioStr) {
        return undefined
    }
    const ratio = parseFloat(ratioStr)
    if (Number.isNaN(ratio)) {
        return undefined
    }
    return ratio
}
