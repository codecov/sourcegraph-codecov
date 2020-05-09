import { createStubSourcegraphAPI } from '@sourcegraph/extension-api-stubs'
import mock from 'mock-require'
mock('sourcegraph', createStubSourcegraphAPI())

import * as assert from 'assert'
import { resolveSettings, Settings } from './settings'

describe('Settings', () => {
    describe('decorations', () => {
        it('applies defaults when not set', () => {
            assert.deepStrictEqual(resolveSettings({})['codecov.decorations.lineCoverage'], false)
        })

        it('respects the hide property', () => {
            assert.deepStrictEqual(
                resolveSettings({
                    'codecov.showCoverage': true,
                    'codecov.decorations.lineCoverage': true,
                    'codecov.decorations.lineHitCounts': true,
                })['codecov.showCoverage'],
                true
            )
        })

        it('respects the other properties', () => {
            const settings: Settings = {
                'codecov.insight.sunburst': false,
                'codecov.insight.icicle': false,
                'codecov.insight.tree': false,
                'codecov.insight.pie': false,
                'codecov.decorations.lineCoverage': false,
                'codecov.decorations.lineHitCounts': true,
                'codecov.showCoverage': true,
                'codecov.endpoints': [
                    {
                        url: 'https://codecov.io',
                    },
                ],
            }
            assert.deepStrictEqual(
                resolveSettings({
                    'codecov.decorations.lineCoverage': false,
                    'codecov.decorations.lineHitCounts': true,
                }),
                settings
            )
        })

        it('applies defaults for the other properties', () => {
            const settings: Settings = {
                'codecov.insight.tree': false,
                'codecov.insight.icicle': false,
                'codecov.insight.sunburst': false,
                'codecov.insight.pie': false,
                'codecov.decorations.lineCoverage': false,
                'codecov.decorations.lineHitCounts': false,
                'codecov.showCoverage': true,
                'codecov.endpoints': [
                    {
                        url: 'https://codecov.io',
                    },
                ],
            }
            assert.deepStrictEqual(resolveSettings({}), settings)
        })
    })
})
