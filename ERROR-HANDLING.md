
Error handling with node-fetch
==============================

Because `window.fetch` isn't designed to be transparent about the cause of request errors, we have to come up with our own solutions.

The basics:

- All [operational errors][joyent-guide] are rejected with a [FetchError](https://github.com/bitinn/node-fetch/blob/master/README.md#class-fetcherror). You can handle them all through the promise `catch` clause.

- All errors come with an `err.message` detailing the cause of errors.

- All errors originating from `node-fetch` are marked with a custom `err.type`.

- All errors originating from Node.js core are marked with `err.type = 'system'`, and in addition contain an `err.code` and an `err.errno` for error handling. These are aliases for error codes thrown by Node.js core.

- [Programmer errors][joyent-guide] are either thrown as soon as possible, or rejected with default `Error` with `err.message` for ease of troubleshooting.

List of error types:

- Because we maintain 100% coverage, see [test.js](https://github.com/bitinn/node-fetch/blob/master/test/test.js) for a full list of custom `FetchError` types, as well as some of the common errors from Node.js

[joyent-guide]: https://www.joyent.com/node-js/production/design/errors#operational-errors-vs-programmer-errors
