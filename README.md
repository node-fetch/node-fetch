ziti-electron-fetch
===================

[![npm version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![install size][install-size-image]][install-size-url]

A module that intercepts all `window.fetch` calls in the web-app loaded within an Electron Renderer process, and routes those HTTP/REST calls over a Ziti network.

<!-- TOC -->

- [Motivation](#motivation)
- [Features](#features)
- [Difference from client-side fetch](#difference-from-client-side-fetch)
- [Installation](#installation)
- [Loading and configuring the module](#loading-and-configuring-the-module)
- [License](#license)
- [Acknowledgement](#acknowledgement)

<!-- /TOC -->

## Motivation

Instead of implementing `XMLHttpRequest` in Node.js to run browser-specific [Fetch polyfill](https://github.com/github/fetch), why not go from native `http` to `fetch` API directly? Hence, `ziti-electron-fetch`, minimal code for a `window.fetch` compatible API on Node.js runtime.


## Features

- Stay consistent with `window.fetch` API.
- Make conscious trade-off when following [WHATWG fetch spec][whatwg-fetch] and [stream spec](https://streams.spec.whatwg.org/) implementation details, document known differences.
- Use native promise but allow substituting it with [insert your favorite promise library].
- Use native Node streams for body on both request and response.
- Useful extensions such as timeout, redirect limit, response size limit, [explicit errors](ERROR-HANDLING.md) for troubleshooting.

## Difference from client-side fetch

- See [Known Differences](LIMITS.md) for details.
- If you happen to use a missing feature that `window.fetch` offers, feel free to open an issue.
- Pull requests are welcomed too!

## Installation

```sh
$ npm install ziti-electron-fetch
```

## Loading and configuring the module
We suggest you load the module via `require` until the stabilization of ES modules in node:
```js
const fetch = require('ziti-electron-fetch');
```


## Acknowledgement

Thanks to [node-fetch](https://github.com/node-fetch/node-fetch) for providing a solid implementation reference.

## License

Apache 2.0

[npm-image]: https://flat.badgen.net/npm/v/ziti-electron-fetch
[npm-url]: https://www.npmjs.com/package/ziti-electron-fetch
[travis-image]: https://flat.badgen.net/travis/netfoundry/ziti-electron-fetch
[travis-url]: https://travis-ci.org/netfoundry/ziti-electron-fetch
[install-size-image]: https://flat.badgen.net/packagephobia/install/ziti-electron-fetch
[install-size-url]: https://packagephobia.now.sh/result?p=ziti-electron-fetch
[whatwg-fetch]: https://fetch.spec.whatwg.org/
[response-init]: https://fetch.spec.whatwg.org/#responseinit
[node-readable]: https://nodejs.org/api/stream.html#stream_readable_streams
[mdn-headers]: https://developer.mozilla.org/en-US/docs/Web/API/Headers
[LIMITS.md]: https://github.com/netfoundry/ziti-electron-fetch/blob/master/LIMITS.md
[ERROR-HANDLING.md]: https://github.com/netfoundry/ziti-electron-fetch/blob/master/ERROR-HANDLING.md
