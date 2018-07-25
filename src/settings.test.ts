import * as assert from 'assert'
import { resolveDecorationSettings, DecorationSettings } from './settings'

describe('resolveDecorationSettings', () => {
  it('applies defaults when not set', () =>
    assert.deepStrictEqual(resolveDecorationSettings({}), {
      lineBackgroundColors: true,
    } as DecorationSettings))

  it('respects the hide property', () =>
    assert.deepStrictEqual(
      resolveDecorationSettings({
        decorations: {
          hide: true,
          lineBackgroundColors: true,
          lineHitCounts: true,
        },
      }),
      {
        hide: true,
      } as DecorationSettings
    ))

  it('respects the other properties', () =>
    assert.deepStrictEqual(
      resolveDecorationSettings({
        decorations: {
          lineBackgroundColors: false,
          lineHitCounts: true,
        },
      }),
      {
        lineBackgroundColors: false,
        lineHitCounts: true,
      } as DecorationSettings
    ))

  it('applies defaults for the other properties', () =>
    assert.deepStrictEqual(
      resolveDecorationSettings({
        decorations: {},
      }),
      {
        lineBackgroundColors: true,
        lineHitCounts: false,
      } as DecorationSettings
    ))
})
