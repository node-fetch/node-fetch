# Upgrade to node-fetch v3.x

node-fetch v3.x brings about many changes that increase the compliance of
WHATWG's [Fetch Standard][whatwg-fetch]. However, many of these changes mean
that apps written for node-fetch v2.x needs to be updated to work with
node-fetch v3.x and be conformant with the Fetch Standard. This document helps
you make this transition.

Note that this document is not an exhaustive list of all changes made in v3.x,
but rather that of the most important breaking changes. See our [changelog] for
other comparatively minor modifications.

## Minimum supported Node.js version is now 10

Since Node.js will deprecate version 8 at the end of 2019, we decided that node-fetch v3.x will not only drop support for Node.js 4 and 6 (which were supported in v2.x), but also for Node.js 8. We strongly encourage you to upgrade, if you still haven't done so. Check out Node.js' official [LTS plan] for more information on Node.js' support lifetime.

## `AbortError` now uses a w3c defined message

To stay spec-compliant, we changed the `AbortError` message to `The operation was aborted.`.

## Data URI support

Previously, node-fetch only supported http url scheme. However, the Fetch Standard recently introduced the `data:` URI support. Following the specification, we implemented this feature in v3.x. Read more about `data:` URLs [here][data-url].

## `Response.statusText` no longer sets a default message derived from the HTTP status code

If the server didn't respond with status text, node-fetch would set a default message derived from the HTTP status code. This behavior was not spec-compliant and now the `statusText` will remain blank instead.

## Bundled TypeScript types

Since v3.x you no longer need to install `@types/node-fetch` package in order to use `node-fetch` with TypeScript.

[whatwg-fetch]: https://fetch.spec.whatwg.org/
[data-url]: https://fetch.spec.whatwg.org/#data-url-processor
[LTS plan]: https://github.com/nodejs/LTS#lts-plan
[changelog]: CHANGELOG.md
