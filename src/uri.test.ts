import * as assert from 'assert'
import {
    resolveURI,
    ResolvedURI,
    codecovParamsForRepositoryCommit,
} from './uri'

describe('resolveURI', () => {
    describe('parsing', () => {
        it('requires a base for file: URIs', () =>
            assert.throws(() => resolveURI('file:///d/f')))

        it('parses git: URIs', () =>
            assert.deepStrictEqual(
                resolveURI('git://example.com/repo?v#d/f'),
                {
                    repo: 'example.com/repo',
                    rev: 'v',
                    path: 'd/f',
                } as ResolvedURI
            ))
    })

    describe('resolving', () => {
        it('resolves file: URIs', () =>
            assert.deepStrictEqual(
                resolveURI('file:///d/f'),
                {
                    repo: 'r',
                    rev: 'v',
                    path: '/d/f',
                } as ResolvedURI
            ))

        it('resolves git: URIs with the same base', () =>
            assert.deepStrictEqual(
                resolveURI('git://example.com/repo?v#d/f'),
                {
                    repo: 'example.com/repo',
                    rev: 'v',
                    path: 'd/f',
                } as ResolvedURI
            ))

        it('resolves git: URIs with a different base', () =>
            assert.deepStrictEqual(
                resolveURI('git://example.com/repo2?v2#d/f'),
                {
                    repo: 'example.com/repo2',
                    rev: 'v2',
                    path: 'd/f',
                } as ResolvedURI
            ))
    })

    it('refuses other URI schemes', () =>
        assert.throws(() => resolveURI('example://a')))
})

describe('codecovParamsForRepo', () => {
    it('handles valid GitHub.com repositories', () =>
        assert.deepStrictEqual(
            codecovParamsForRepositoryCommit({
                repo: 'github.com/owner/repo',
                rev: 'v',
            }),
            { service: 'gh', owner: 'owner', repo: 'repo', sha: 'v' }
        ))

    it('throws an error for invalid GitHub.com repositories', () =>
        assert.throws(() =>
            codecovParamsForRepositoryCommit({
                repo: 'github.com/owner/repo/invalid',
                rev: 'v',
            })
        ))

    it('throws an error for unsupported repositories', () =>
        assert.throws(() =>
            codecovParamsForRepositoryCommit({
                repo: 'example.com/owner/repo',
                rev: 'v',
            })
        ))
})
