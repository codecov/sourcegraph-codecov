import { LineCoverage, FileLineCoverage } from './model'
import { Settings } from './settings'
import { TextDocumentDecoration } from 'sourcegraph/module/protocol'
import { hsla, RED_HUE, GREEN_HUE, YELLOW_HUE } from './colors'

export function codecovToDecorations(
    settings: Pick<
        Settings,
        'codecov.decorations.lineCoverage' | 'codecov.decorations.lineHitCounts'
    >,
    data: FileLineCoverage
): TextDocumentDecoration[] {
    if (!data) {
        return []
    }
    const decorations: TextDocumentDecoration[] = []
    for (const [line, coverage] of Object.entries(data)) {
        if (coverage === null) {
            continue
        }
        const decoration: TextDocumentDecoration = {
            range: {
                start: { line: parseInt(line) - 1, character: 0 },
                end: { line: parseInt(line) - 1, character: 1 },
            },
            isWholeLine: true,
        }
        if (settings['codecov.decorations.lineCoverage']) {
            decoration.backgroundColor = lineColor(coverage, 0.7, 0.25)
        }
        if (settings['codecov.decorations.lineHitCounts']) {
            decoration.after = {
                backgroundColor: lineColor(coverage, 0.7, 1),
                color: lineColor(coverage, 0.25, 1),
                ...lineText(coverage),
            }
        }
        decorations.push(decoration)
    }
    return decorations
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
    return hsla(hue, lightness, alpha)
}

function lineText(
    coverage: LineCoverage
): { contentText?: string; hoverMessage?: string } {
    if (coverage === null) {
        return {}
    }
    if (typeof coverage === 'number') {
        if (coverage >= 1) {
            return {
                contentText: ` ${coverage} `,
                hoverMessage: `${coverage} hit${
                    coverage === 1 ? '' : 's'
                } (Codecov)`,
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
