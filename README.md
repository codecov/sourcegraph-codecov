# Codecov Sourcegraph extension

[![Build Status](https://travis-ci.org/codecov/sourcegraph-codecov.svg?branch=master)](https://travis-ci.org/codecov/sourcegraph-codecov)
[![codecov](https://codecov.io/gh/codecov/sourcegraph-codecov/branch/master/graph/badge.svg)](https://codecov.io/gh/codecov/sourcegraph-codecov)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fcodecov%2Fsourcegraph-codecov.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fcodecov%2Fsourcegraph-codecov?ref=badge_shield)

A [Sourcegraph extension](https://docs.sourcegraph.com/extensions) for showing code coverage information from [Codecov](https://codecov.io) on GitHub, Sourcegraph, and other tools.

[**🎥 Demo video**](https://www.youtube.com/watch?v=j1eWBa3rWH8)

[**🗃️ Source code**](https://github.com/codecov/sourcegraph-codecov)

[**➕ Add to Sourcegraph**](https://sourcegraph.com/extensions/sourcegraph/codecov)

## Features

-   Support for GitHub.com and Sourcegraph.com
-   Line coverage overlays on files (with green/yellow/red background colors)
-   Line branches/hits annotations on files
-   File coverage ratio indicator (`Coverage: N%`) and toggle button
-   Support for using a Codecov API token to see coverage for private repositories
-   File and directory coverage decorations on Sourcegraph

## Usage

### On GitHub using the Chrome extension

1.  Install [Sourcegraph for Chrome](https://chrome.google.com/webstore/detail/sourcegraph/dgjhfomjieaadpoljlnidmbgkdffpack)
1.  [Enable the Codecov extension on Sourcegraph](https://sourcegraph.com/extensions/sourcegraph/codecov)
1.  Visit [tuf_store.go in theupdateframework/notary on GitHub](https://github.com/theupdateframework/notary/blob/master/server/storage/tuf_store.go) (or any other file in a public repository that has Codecov code coverage)
1.  Click the `Coverage: N%` button to toggle Codecov test coverage background colors on the file (scroll down if they aren't immediately visible)

![Screenshot](https://user-images.githubusercontent.com/1976/45107396-53d56880-b0ee-11e8-96e9-ca83e991101c.png)

#### With private GitHub.com repositories

You can use the Codecov extension for private repositories on GitHub.com. Your code is never sent to Sourcegraph.

1.  Follow the [Codecov extension usage instructions](https://github.com/codecov/sourcegraph-codecov#usage) above to install Sourcegraph for Chrome
2.  Go to the command palette on GitHub (added by the Sourcegraph browser extension, see screenshot below) and choose "Codecov: Set API token for private repositories"
3.  Enter your Codecov API token
4.  Visit any file in a GitHub.com private repository that has Codecov coverage data

![image](https://user-images.githubusercontent.com/1976/45338265-04a19480-b541-11e8-9b35-517f3bbff530.png)

Your code is never sent to Sourcegraph. The Codecov extension runs on the client side in a Web Worker and communicates with Codecov directly to retrieve code coverage data.

#### With Codecov Enterprise and GitHub Enterprise

You can use this extension to overlay coverage information from your Codecov Enterprise install into GitHub Enterprise.

1.  Follow the [Codecov extension usage instructions](https://github.com/codecov/sourcegraph-codecov#usage) above to install Sourcegraph for Chrome
2.  From the command palette (added by the Sourcegraph browser extension, see screenshot above) on GitHub Enterprise click, "Codecov: Setup up Codecov Enterprise"
3.  From the pop up that appears, set your Version control type to: `ghe`
4.  From the next pop up that appears, set your Codecov endpoint, this is just the root level of your Codecov Enterprise domain, e.g., `https://codecov.mycompany.com`.
5.  Go to the command palette on GitHub and choose "Codecov: Set API token for private repositories"
6.  Enter your Codecov Enterprise API token.
7.  Visit any file in your Github Enterprise install with coverage data uploaded to Codecov Enterprise to see coverage data.

Note: Additional documentation, if needed, can be found in [Codecov's official documentation](https://docs.codecov.io/docs/browser-extension#section-additional-steps-for-on-premises-codecov-customers).

### On Sourcegraph.com

1.  Visit [tuf_store.go in theupdateframework/notary](https://sourcegraph.com/github.com/theupdateframework/notary@fb795b0bc868746ed2efa2cd7109346bc7ddf0a4/-/blob/server/storage/tuf_store.go) on Sourcegraph.com (or any other file that has Codecov code coverage)
2.  Click the `Coverage: N%` button to toggle Codecov test coverage background colors on the file (sign-in required)

> The Codecov extension is enabled by default on Sourcegraph.com, so you don't need to add it from its [extension registry listing](https://sourcegraph.com/extensions/sourcegraph/codecov).

#### With a self-hosted Sourcegraph instance and the browser extension

#### File decorations

Enable file decorations in user, organization or global settings to see coverage status of files and directories in the file tree and on directory pages.

```jsonc
{
    "codecov.fileDecorations.show": true
}
```

![File decorations](https://user-images.githubusercontent.com/37420160/101069758-6ad2c180-3568-11eb-9778-f20f59f46d6f.png)

## License

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fcodecov%2Fsourcegraph-codecov.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fcodecov%2Fsourcegraph-codecov?ref=badge_large)
