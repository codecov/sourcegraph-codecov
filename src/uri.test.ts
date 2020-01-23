import { createStubSourcegraphAPI } from '@sourcegraph/extension-api-stubs'
import * as assert from 'assert'
import { codecovParamsForRepositoryCommit, resolveDocumentURI } from './uri'

describe('resolveDocumentURI', () => {
    const UNSUPPORTED_SCHEMES = ['file:', 'http:', 'https:']

    const MOCK_RESOLVE_REPO_NAME = (name: string): Promise<string> =>
        Promise.resolve(name)

    for (const p of UNSUPPORTED_SCHEMES) {
        it(`throws for ${p} uris`, async () => {
            await assert.rejects(
                resolveDocumentURI(
                    `${p}://github.com/sourcegraph/sourcegraph`,
                    MOCK_RESOLVE_REPO_NAME
                ),
                `Invalid protocol: ${p}`
            )
        })
    }

    it('throws if url.search is falsy', async () => {
        await assert.rejects(() =>
            resolveDocumentURI(
                'git://github.com/sourcegraph/sourcegraph',
                MOCK_RESOLVE_REPO_NAME
            )
        )
    })

    it('throws if url.hash is falsy', async () => {
        await assert.rejects(() =>
            resolveDocumentURI(
                'git://github.com/sourcegraph/sourcegraph',
                MOCK_RESOLVE_REPO_NAME
            )
        )
    })

    it('resolves git: URIs', async () => {
        assert.deepStrictEqual(
            await resolveDocumentURI(
                'git://github.com/sourcegraph/sourcegraph?a8215fe4bd9571b43d7a03277069445adca85b2a#pkg/extsvc/github/codehost.go',
                MOCK_RESOLVE_REPO_NAME
            ),
            {
                path: 'pkg/extsvc/github/codehost.go',
                repo: 'github.com/sourcegraph/sourcegraph',
                rev: 'a8215fe4bd9571b43d7a03277069445adca85b2a',
            }
        )
    })

    it('returns the repo name resolved from the Sourcegraph instance', async () => {
        assert.deepStrictEqual(
            await resolveDocumentURI('git://a/b?c#d/e.go', name =>
                Promise.resolve(`github.com/${name}`)
            ),
            {
                path: 'd/e.go',
                repo: 'github.com/a/b',
                rev: 'c',
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
                baseURL: '',
                service: 'gh',
                owner: 'owner',
                repo: 'repo',
                sha: 'v',
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
                baseURL: '',
                owner: 'owner',
                repo: 'repo',
                service: 'gh',
                sha: 'v',
            }
        ))
})
