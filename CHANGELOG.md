
Changelog
=========


# 2.x release

## v2.0.0-alpha.1 (UNRELEASED)

- Major: Node.js 0.10.x support is dropped
- Major: rewrite in transpiled ES2015
- Major: internal methods are no longer exposed
- Major: throw error when a GET/HEAD Request is constructed with a non-null body (per spec)
- Major: `response.text()` no longer attempts to detect encoding, instead always opting for UTF-8 (per spec); use `response.textConverted()` for the old behavior
- Major: make `response.json()` throw error instead of returning an empty object on 204 no-content respose (per spec; reverts behavior set in v1.6.2)
- Major: arrays as parameters to `headers.append` and `headers.set` are joined as a string (per spec)
- Enhance: start testing on Node.js 4, 6, 7
- Enhance: use Rollup to produce a distributed bundle (less memory overhead and faster startup)
- Enhance: make `toString()` on Headers, Requests, and Responses return correct IDL class strings
- Enhance: add an option to conform to latest spec at the expense of reduced compatibility
- Enhance: set `Content-Length` header for Buffers as well
- Enhance: add `response.arrayBuffer()` (also applies to Requests)
- Enhance: add experimental `response.blob()` (also applies to Requests)
- Enhance: make Headers iterable
- Enhance: make Headers constructor accept an array of tuples
- Enhance: make sure header names and values are valid in HTTP
- Fix: coerce Headers prototype function parameters to strings, where applicable
- Fix: fix Request and Response with `null` body
- Fix: support WHATWG URL objects, created by `whatwg-url` package or `require('url').URL` in Node.js 7+
- Other: use Codecov for code coverage tracking


# 1.x release

## v1.6.3

- Enhance: error handling document to explain `FetchError` design
- Fix: support `form-data` 2.x releases (requires `form-data` >= 2.1.0)

## v1.6.2

- Enhance: minor document update
- Fix: response.json() returns empty object on 204 no-content response instead of throwing a syntax error

## v1.6.1

- Fix: if `res.body` is a non-stream non-formdata object, we will call `body.toString` and send it as a string
- Fix: `counter` value is incorrectly set to `follow` value when wrapping Request instance
- Fix: documentation update

## v1.6.0

- Enhance: added `res.buffer()` api for convenience, it returns body as a Node.js buffer
- Enhance: better old server support by handling raw deflate response
- Enhance: skip encoding detection for non-HTML/XML response
- Enhance: minor document update
- Fix: HEAD request doesn't need decompression, as body is empty
- Fix: `req.body` now accepts a Node.js buffer

## v1.5.3

- Fix: handle 204 and 304 responses when body is empty but content-encoding is gzip/deflate
- Fix: allow resolving response and cloned response in any order
- Fix: avoid setting `content-length` when `form-data` body use streams
- Fix: send DELETE request with content-length when body is present
- Fix: allow any url when calling new Request, but still reject non-http(s) url in fetch

## v1.5.2

- Fix: allow node.js core to handle keep-alive connection pool when passing a custom agent

## v1.5.1

- Fix: redirect mode `manual` should work even when there is no redirection or broken redirection

## v1.5.0

- Enhance: rejected promise now use custom `Error` (thx to @pekeler)
- Enhance: `FetchError` contains `err.type` and `err.code`, allows for better error handling (thx to @pekeler)
- Enhance: basic support for redirect mode `manual` and `error`, allows for location header extraction (thx to @jimmywarting for the initial PR)

## v1.4.1

- Fix: wrapping Request instance with FormData body again should preserve the body as-is

## v1.4.0

- Enhance: Request and Response now have `clone` method (thx to @kirill-konshin for the initial PR)
- Enhance: Request and Response now have proper string and buffer body support (thx to @kirill-konshin)
- Enhance: Body constructor has been refactored out (thx to @kirill-konshin)
- Enhance: Headers now has `forEach` method (thx to @tricoder42)
- Enhance: back to 100% code coverage
- Fix: better form-data support (thx to @item4)
- Fix: better character encoding detection under chunked encoding (thx to @dsuket for the initial PR)

## v1.3.3

- Fix: make sure `Content-Length` header is set when body is string for POST/PUT/PATCH requests
- Fix: handle body stream error, for cases such as incorrect `Content-Encoding` header
- Fix: when following certain redirects, use `GET` on subsequent request per Fetch Spec
- Fix: `Request` and `Response` constructors now parse headers input using `Headers`

## v1.3.2

- Enhance: allow auto detect of form-data input (no `FormData` spec on node.js, this is form-data specific feature)

## v1.3.1

- Enhance: allow custom host header to be set (server-side only feature, as it's a forbidden header on client-side)

## v1.3.0

- Enhance: now `fetch.Request` is exposed as well

## v1.2.1

- Enhance: `Headers` now normalized `Number` value to `String`, prevent common mistakes

## v1.2.0

- Enhance: now fetch.Headers and fetch.Response are exposed, making testing easier

## v1.1.2

- Fix: `Headers` should only support `String` and `Array` properties, and ignore others

## v1.1.1

- Enhance: now req.headers accept both plain object and `Headers` instance

## v1.1.0

- Enhance: timeout now also applies to response body (in case of slow response)
- Fix: timeout is now cleared properly when fetch is done/has failed

## v1.0.6

- Fix: less greedy content-type charset matching

## v1.0.5

- Fix: when `follow = 0`, fetch should not follow redirect
- Enhance: update tests for better coverage
- Enhance: code formatting
- Enhance: clean up doc

## v1.0.4

- Enhance: test iojs support
- Enhance: timeout attached to socket event only fire once per redirect

## v1.0.3

- Fix: response size limit should reject large chunk
- Enhance: added character encoding detection for xml, such as rss/atom feed (encoding in DTD)

## v1.0.2

- Fix: added res.ok per spec change

## v1.0.0

- Enhance: better test coverage and doc


# 0.x release

## v0.1

- Major: initial public release
