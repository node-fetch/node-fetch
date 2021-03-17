# @web-std/fetch

![Node.js CI][node.js ci]
[![package][version.icon] ![downloads][downloads.icon]][package.url]

This is a fork of [node-fetch][] library that chooses to follow [WHATWG fetch spec][whatwg-fetch] and use [web streams](https://streams.spec.whatwg.org/) as opposed to using native Node streams.


## License

[MIT](LICENSE.md)

[whatwg-fetch]: https://fetch.spec.whatwg.org/
[response-init]: https://fetch.spec.whatwg.org/#responseinit
[node-readable]: https://nodejs.org/api/stream.html#stream_readable_streams
[mdn-headers]: https://developer.mozilla.org/en-US/docs/Web/API/Headers
[error-handling.md]: https://github.com/node-fetch/node-fetch/blob/master/docs/ERROR-HANDLING.md

[node.js ci]: https://github.com/web-std/fetch/workflows/Node.js%20CI/badge.svg
[version.icon]: https://img.shields.io/npm/v/@web-std/fetch.svg
[downloads.icon]: https://img.shields.io/npm/dm/@web-std/fetch.svg
[package.url]: https://npmjs.org/package/@web-std/fetch
[downloads.image]: https://img.shields.io/npm/dm/@web-std/blob.svg
[downloads.url]: https://npmjs.org/package/@web-std/blob
[prettier.icon]: https://img.shields.io/badge/styled_with-prettier-ff69b4.svg
[prettier.url]: https://github.com/prettier/prettier
[blob]: https://developer.mozilla.org/en-US/docs/Web/API/Blob/Blob
[fetch-blob]: https://github.com/node-fetch/fetch-blob
[readablestream]: https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
[readable]: https://nodejs.org/api/stream.html#stream_readable_streams
[w3c blob.stream]: https://w3c.github.io/FileAPI/#dom-blob-stream
[web-streams-polyfill]:https://www.npmjs.com/package/web-streams-polyfill
[for await]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of
[buffer]: https://nodejs.org/api/buffer.html
[weakmap]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
[ts-jsdoc]: https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html
[Uint8Array]:https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array
[node-fetch]:https://github.com/node-fetch/
