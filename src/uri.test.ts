import { createStubSourcegraphAPI } from '@sourcegraph/extension-api-stubs'
import mock from 'mock-require'
mock('sourcegraph', createStubSourcegraphAPI())

import * as assert from 'assert'
import { codecovParamsForRepositoryCommit, resolveDocumentURI } from './uri'

describe('resolveDocumentURI', () => {
    const UNSUPPORTED_SCHEMES = ['file:', 'http:', 'https:']

    for (const p of UNSUPPORTED_SCHEMES) {
        it(`throws for ${p} uris`, () => {
            assert.throws(
                () =>
                    resolveDocumentURI(
                        'git://github.com/sourcegraph/sourcegraph'
                    ),
                `Invalid protocol: ${p}`
            )
        })
    }

    it('throws if url.search is falsy', () => {
        assert.throws(() =>
            resolveDocumentURI('git://github.com/sourcegraph/sourcegraph')
        )
    })

    it('throws if url.hash is falsy', () => {
        assert.throws(() =>
            resolveDocumentURI('git://github.com/sourcegraph/sourcegraph')
        )
    })

    it('resolves git: URIs', () => {
        assert.deepStrictEqual(
            resolveDocumentURI(
                'git://github.com/sourcegraph/sourcegraph?a8215fe4bd9571b43d7a03277069445adca85b2a#pkg/extsvc/github/codehost.go'
            ),
            {
                path: 'pkg/extsvc/github/codehost.go',
                repo: 'github.com/sourcegraph/sourcegraph',
                rev: 'a8215fe4bd9571b43d7a03277069445adca85b2a',
            }
        )
    })
})

describe('codecovParamsForRepo', () => {
    const sourcegraph = createStubSourcegraphAPI()

    it('handles valid GitHub.com repositories', () =>
        assert.deepStrictEqual(
            codecovParamsForRepositoryCommit(
                {
                    repo: 'github.com/owner/repo',
                    rev: 'v',
                },
                sourcegraph
            ),
            {
                baseURL: 'https://codecov.io',
                service: 'gh',
                owner: 'owner',
                repo: 'repo',
                sha: 'v',
                token: undefined,
            }
        ))

    it('defaults to gh when the service cannot be determined', () =>
        assert.deepStrictEqual(
            codecovParamsForRepositoryCommit(
                {
                    repo: 'example.com/owner/repo',
                    rev: 'v',
                },
                sourcegraph
            ),
            {
                baseURL: 'https://codecov.io',
                owner: 'owner',
                repo: 'repo',
                service: 'gh',
                sha: 'v',
                token: undefined,
            }
        ))
})
