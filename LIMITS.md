
Known limits
============

**As of 1.x release**

- Topics such as cross-origin, CSP, mixed content are ignored, given our server-side context.

- Url input must be an absolute url, using either `http` or `https` as scheme.

- Doesn't export `Headers`, `Body`, `Request`, `Response` classes yet, as we currenly use a much simpler implementation.

- For convenience, `res.body()` is a transform stream instead of byte stream, so decoding can be handled independently.

- Similarly, `options.body` can either be a string or a readable stream.

- For convenience, maximum redirect count (`options.follow`) and request timeout (`options.timeout`) are adjustable.

- There is currently no built-in caching support, as server-side requirement varies greatly between use-cases.
