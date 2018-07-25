import * as assert from 'assert'
import { resolveURI, ResolvedURI } from './uri'

describe('resolveURI', () => {
  describe('parsing', () => {
    it('requires a base for file: URIs', () =>
      assert.throws(() => resolveURI(null, 'file:///d/f')))

    it('parses git: URIs', () =>
      assert.deepStrictEqual(resolveURI(null, 'git://example.com/repo?v#d/f'), {
        repo: 'example.com/repo',
        rev: 'v',
        path: 'd/f',
      } as ResolvedURI))
  })

  describe('resolving', () => {
    it('resolves file: URIs', () =>
      assert.deepStrictEqual(
        resolveURI({ repo: 'r', rev: 'v' }, 'file:///d/f'),
        {
          repo: 'r',
          rev: 'v',
          path: '/d/f',
        } as ResolvedURI
      ))

    it('resolves git: URIs with the same base', () =>
      assert.deepStrictEqual(
        resolveURI(
          { repo: 'example.com/repo', rev: 'v' },
          'git://example.com/repo?v#d/f'
        ),
        {
          repo: 'example.com/repo',
          rev: 'v',
          path: 'd/f',
        } as ResolvedURI
      ))

    it('resolves git: URIs with a different base', () =>
      assert.deepStrictEqual(
        resolveURI(
          { repo: 'example.com/repo', rev: 'v' },
          'git://example.com/repo2?v2#d/f'
        ),
        {
          repo: 'example.com/repo2',
          rev: 'v2',
          path: 'd/f',
        } as ResolvedURI
      ))
  })

  it('refuses other URI schemes', () =>
    assert.throws(() => resolveURI(null, 'example://a')))
})
