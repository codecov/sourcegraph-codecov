import { getCommitCoverageData, GetCommitCoverageDataArgs } from './api'

export interface FileCoverage {
  ratio?: string
  lines?: { [line: string]: LineCoverage }
}

export type LineCoverage = number | { hits: number; branches: number }

export class Model {
  public static async getCoverageForFile({
    path,
    ...args
  }: { path: string } & GetCommitCoverageDataArgs): Promise<FileCoverage> {
    const data = await getCommitCoverageData(args)
    const fileData = data.commit.report.files[path]
    return fileData ? asFileCoverage(fileData) : {}
  }
}

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
