# Codecov CXP extension

See code coverage information from [Codecov](https://codecov.io) on GitHub and any other platform that supports the [Code Extension Protocol (CXP)](https://github.com/sourcegraph/cxp-js).

**NOTE:** This repository will be moved to the `codecov` GitHub org.

## EXPERIMENTAL: Usage instructions

1.  Follow steps 1-6 at https://github.com/sourcegraph/sourcegraph/pull/12325 first.
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
