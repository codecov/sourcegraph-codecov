# Codecov CXP extension (WIP)

See code coverage information from [Codecov](https://codecov.io) on GitHub and any other platform that supports the [Code Extension Protocol (CXP)](https://github.com/sourcegraph/cxp-js).

**NOTE:** This repository's history will be rewritten before being published.

## EXPERIMENTAL: Usage instructions (currently only for Sourcegraphers)

1.  Clone this repository and run `npm install && npm run serve`.
1.  In your Sourcegraph dev instance, create an extension and add the following to the manifest (change the port number if `npm run serve` reported a different port):
    ```json
    {
        ...,
        "platform": {"type": "bundle", "url": "http://localhost:1234/cx-codecov.js"},
        ...
    }
    ```
1.  Enable the extension and visit a file such as http://localhost:3080/github.com/theupdateframework/notary/-/blob/tuf/signed/sign.go that has Codecov coverage data. You should see lines colors green, yellow, and red.
