
Known differences
=================

*As of 2.x release*

- Topics such as Cross-Origin, Content Security Policy, Mixed Content, Service Workers are ignored, given our server-side context.

- URL input must be an absolute URL, using either `http` or `https` as scheme.

- On the upside, there are no forbidden headers, and `res.url` contains the final url when following redirects.

- For convenience, `res.body` is a transform stream, so decoding can be handled independently.

- Similarly, `req.body` can either be a string, a buffer or a readable stream.

- Also, you can handle rejected fetch requests through checking `err.type` and `err.code`.

- Only support `res.text()`, `res.json()`, `res.blob()`, `res.arraybuffer()`, `res.buffer()`

- There is currently no built-in caching, as server-side caching varies by use-cases.

- Current implementation lacks server-side cookie store, you will need to extract `Set-Cookie` headers manually.

- If you are using `res.clone()` and writing an isomorphic app, note that stream on Node.js have a smaller internal buffer size (16Kb, aka `highWaterMark`) from client-side browsers (>1Mb, not consistent across browsers).
