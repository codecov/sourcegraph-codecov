import * as assert from 'assert'
import { resolveSettings, DecorationSettings } from './settings'

describe('Settings', () => {
  describe('decorations', () => {
    it('applies defaults when not set', () =>
      assert.deepStrictEqual(resolveSettings({})['codecov.decorations'], {
        lineBackgroundColors: true,
      } as DecorationSettings))

    it('respects the hide property', () =>
      assert.deepStrictEqual(
        resolveSettings({
          decorations: {
            hide: true,
            lineBackgroundColors: true,
            lineHitCounts: true,
          },
        })['codecov.decorations'],
        {
          hide: true,
        } as DecorationSettings
      ))

    it('respects the other properties', () =>
      assert.deepStrictEqual(
        resolveSettings({
          decorations: {
            lineBackgroundColors: false,
            lineHitCounts: true,
          },
        })['codecov.decorations'],
        {
          lineBackgroundColors: false,
          lineHitCounts: true,
        } as DecorationSettings
      ))

    it('applies defaults for the other properties', () =>
      assert.deepStrictEqual(
        resolveSettings({
          decorations: {},
        })['codecov.decorations'],
        {
          lineBackgroundColors: true,
          lineHitCounts: false,
        } as DecorationSettings
      ))
  })
})
