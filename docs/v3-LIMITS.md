
Known differences
=================

*As of 3.x release*

- Topics such as Cross-Origin, Content Security Policy, Mixed Content, Service Workers are ignored, given our server-side context.

- On the upside, there are no forbidden headers.

- `res.url` contains the final url when following redirects.

- For convenience, `res.body` is a Node.js [Readable stream][readable-stream], so decoding can be handled independently.

- Similarly, `req.body` can either be `null`, a string, a buffer or a Readable stream.

- Also, you can handle rejected fetch requests through checking `err.type` and `err.code`. See [ERROR-HANDLING.md][] for more info.

- Only support `res.text()`, `res.json()`, `res.blob()`, `res.arraybuffer()`, `res.buffer()`

- There is currently no built-in caching, as server-side caching varies by use-cases.

- Current implementation lacks server-side cookie store, you will need to extract `Set-Cookie` headers manually.

- If you are using `res.clone()` and writing an isomorphic app, note that stream on Node.js have a smaller internal buffer size (16Kb, aka `highWaterMark`) from client-side browsers (>1Mb, not consistent across browsers). Learn [how to get around this][highwatermark-fix].

- Because Node.js stream doesn't expose a [*disturbed*](https://fetch.spec.whatwg.org/#concept-readablestream-disturbed) property like Stream spec, using a consumed stream for `new Response(body)` will not set `bodyUsed` flag correctly.

[readable-stream]: https://nodejs.org/api/stream.html#stream_readable_streams
[ERROR-HANDLING.md]: https://github.com/bitinn/node-fetch/blob/master/docs/ERROR-HANDLING.md
[highwatermark-fix]: https://github.com/bitinn/node-fetch/blob/master/README.md#custom-highwatermark
