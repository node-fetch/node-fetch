# Upgrade to node-fetch v3.x

node-fetch v4.x brings about many changes that increase the compliance of
WHATWG's [Fetch Standard][whatwg-fetch]. However, many of these changes mean
that apps written for earlier version needs to be updated to work with
node-fetch v3.x and be conformant with the Fetch Standard. This document helps
you make this transition.

Note that this document is not an exhaustive list of all changes made in v3.x,
but rather that of the most important breaking changes. See our releases for
other comparatively minor modifications.

---

## Minimum supported Node.js version is now 14.17

Node.js 12 ends long time support in April 2022, we have decided that
node-fetch v4 will drop support for Node.js 14.17 and below (which were
previously supported). We strongly encourage you to upgrade if you still haven't
done so. Check out the Node.js official [LTS plan] for more information.


#### Why 14.17 and not 14.x?
fetch is built around AbortController & AbortSignal in mind. v14.17 is the first
version that added support for passing in a AbortSignal into `http.request()`
We wish to use this feature and pass it along to the request.

Request is also required to have a AbortSignal as a property.

## Removed functionalities.

We strive harder to match the spec, so that you can expect the same functionality
across different environments to work the same wherever you are. That meant that
some node-fetch only features had to go away.

- Deprecated `response.buffer()` have been removed
- The node-fetch only `size` limit option have been removed.
- The `form-data` package have been removed in favor of a spec'ed one instead
  `import { FormData } from 'node-fetch'`.

## Headers class have been swapped out for the `fetch-headers` package
We have had a own Headers class that have extended the `URLSearchParams` and
brought all of the features of URLSearchParams into the Headers, This is not OK.
The `fetch-headers` package have been broken out into a separate package for
others to use who only wish to use this.
This `fetch-headers` also runs all test against WPT, same test run by browsers
to make sure it work as it should.

Noticeable differences are:
- `headers.raw()` is no longer possible to use.
- `headers.getAll()` is no longer possible to use.
- `content-encoding` is no longer normalized to all lowercase letters.

## The `.body` stream have changed.
Many have long wished for fetch to be built in right into NodeJS. But it's built
up by so many peaces. One of the requirements is that it uses web streams instead
of Node streams. We would never thought that NodeJS would ever add this when we
first started this project and would only complicate things such as writing files
to the filesystem. But now here they are built right into NodeJS!

The `response.body` and `request.body` is now a whatwg stream instead of a Node
stream.

We use built in `node:stream/web` whenever it's available and fallback to using
`web-streams-polyfill` when it's not available thanks to top level await for
conditional imports.

if you still need it to be a Node stream then you can use either
[stream.Readable.from()](fromIterable) or [stream.Readable.fromWeb](fromWeb)

Alternative you can go the other way around and convert your node streams to web
stream
```js
import stream from 'node:stream'
import { CompressionStream } from 'node:stream/web'
import fs from 'node:fs'

const writable = fs.createWriteStream('sample.bin')
const writableStream = stream.Writable.toWeb(writable)

new Response('abc').body
  .pipeThrough(new CompressionStream('gzip'))
  .pipeTo(writableStream)
```



[fromIterable]: https://nodejs.org/dist/latest-v17.x/docs/api/stream.html#streamreadablefromiterable-options
[fromWeb]: https://nodejs.org/dist/latest-v17.x/docs/api/stream.html#streamreadablefromwebreadablestream-options
