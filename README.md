# Codecov Sourcegraph extension

A [Sourcegraph extension](https://github.com/sourcegraph/sourcegraph-extension-api) for showing code coverage information from [Codecov](https://codecov.io) on GitHub, Sourcegraph, and other tools.

[**🎥 Demo video**](https://www.youtube.com/watch?v=j1eWBa3rWH8)

[**🗃️ Source code**](https://github.com/sourcegraph/sourcegraph-codecov)

[**➕ Add to Sourcegraph**](https://sourcegraph.com/extensions/sourcegraph/codecov) (enabled by default on Sourcegraph.com and in Sourcegraph for Chrome)

## Features

-   Support for GitHub.com and Sourcegraph.com
-   Line coverage overlays on files (with green/yellow/red background colors)
-   Line branches/hits annotations on files
-   File coverage ratio indicator (`Coverage: N%`) and toggle button
-   Support for using a Codecov API token to see coverage for private repositories

## Usage

### On GitHub using the Chrome extension

1. Install [Sourcegraph for Chrome](https://chrome.google.com/webstore/detail/sourcegraph/dgjhfomjieaadpoljlnidmbgkdffpack)
2. Open the Sourcegraph Chrome extension options page (by clicking the Sourcegraph icon in the Chrome toolbar)
3. Check the box labeled **Use Sourcegraph extensions** (required while this feature is in alpha)
4. Visit [tuf_store.go in theupdateframework/notary on GitHub](https://github.com/theupdateframework/notary/blob/fb795b0bc868746ed2efa2cd7109346bc7ddf0a4/server/storage/tuf_store.go) (or any other file in a public repository that has Codecov code coverage)
5. Click the `Coverage: N%` button to toggle Codecov test coverage background colors on the file (scroll down if they aren't immediately visible)

![Screenshot](https://user-images.githubusercontent.com/1976/45107396-53d56880-b0ee-11e8-96e9-ca83e991101c.png)

### On Sourcegraph.com

1. Visit [tuf_store.go in theupdateframework/notary](https://sourcegraph.com/github.com/theupdateframework/notary@fb795b0bc868746ed2efa2cd7109346bc7ddf0a4/-/blob/server/storage/tuf_store.go) on Sourcegraph.com (or any other file that has Codecov code coverage)
2. Click the `Coverage: N%` button to toggle Codecov test coverage background colors on the file (sign-in required)

> The Codecov extension is enabled by default on Sourcegraph.com, so you don't need to add it from its [extension registry listing](https://sourcegraph.com/extensions/sourcegraph/codecov).
