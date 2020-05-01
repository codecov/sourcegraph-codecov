import { Range, TextDocumentDecoration } from 'sourcegraph'
import { hsl } from './colors'
import { FileLineCoverage, LineCoverage } from './model'
import { Settings } from './settings'

export function codecovToDecorations(
    settings: Pick<Settings, 'codecov.decorations.lineCoverage' | 'codecov.decorations.lineHitCounts'>,
    data: FileLineCoverage
): TextDocumentDecoration[] {
    if (!data) {
        return []
    }
    const decorations: TextDocumentDecoration[] = []
    for (const [lineStr, coverage] of Object.entries(data)) {
        if (coverage === null) {
            continue
        }
        const line = parseInt(lineStr, 10) - 1 // 0-indexed line
        const decoration: TextDocumentDecoration = {
            range: new Range(line, 0, line, 0),
            isWholeLine: true,
        }
        if (settings['codecov.decorations.lineCoverage']) {
            decoration.light = {
                backgroundColor: lineColor(coverage, 0.8),
            }
            decoration.dark = {
                backgroundColor: lineColor(coverage, 0.2),
            }
        }
        if (settings['codecov.decorations.lineHitCounts']) {
            decoration.after = {
                ...lineText(coverage),
                backgroundColor: lineColor(coverage, 0.4),
                color: 'white',
            }
        }
        decorations.push(decoration)
    }
    return decorations
}

function lineColor(coverage: LineCoverage, lightness: number): string {
    if (coverage === 0 || coverage === null) {
        return hsl(0, 1, lightness) // red
    }
    if (typeof coverage === 'number' || coverage.hits === coverage.branches) {
        return hsl(120, 0.64, lightness) // green
    }
    return hsl(62, 0.97, lightness) // partially covered, yellow
}

function lineText(coverage: LineCoverage): { contentText?: string; hoverMessage?: string } {
    if (coverage === null) {
        return {}
    }
    if (typeof coverage === 'number') {
        if (coverage >= 1) {
            return {
                contentText: ` ${coverage} `,
                hoverMessage: `${coverage} hit${coverage === 1 ? '' : 's'} (CodeCov)`,
            }
        }
        return {
            contentText: ' 0 ',
            hoverMessage: 'not covered by test (CodeCov)',
        }
    }
    return {
        contentText: ` ${coverage.hits}/${coverage.branches} `,
        hoverMessage: `${coverage.hits}/${coverage.branches} branch${
            coverage.branches === 1 ? '' : 'es'
        } hit (CodeCov)`,
    }
}
