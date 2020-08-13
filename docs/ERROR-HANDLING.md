
Error handling with node-fetch
==============================

Because `window.fetch` isn't designed to be transparent about the cause of request errors, we have to come up with our own solutions.

The basics:

- A cancelled request is rejected with an [`AbortError`](https://github.com/node-fetch/node-fetch/blob/master/README.md#class-aborterror). You can check if the reason for rejection was that the request was aborted by checking the `Error`'s `name` is `AbortError`.

```js
const fetch = require('node-fetch');

(async () => {
		try {
				await fetch(url, {signal});
		} catch (error) {
				if (error.name === 'AbortError') {
    				console.log('request was aborted');
  			}
		}
})();
```

- All [operational errors][joyent-guide] *other than aborted requests* are rejected with a [FetchError](https://github.com/node-fetch/node-fetch/blob/master/README.md#class-fetcherror). You can handle them all through the `try/catch` block or promise `catch` clause.

- All errors come with an `error.message` detailing the cause of errors.

- All errors originating from `node-fetch` are marked with a custom `err.type`.

- All errors originating from Node.js core are marked with `error.type = 'system'`, and in addition contain an `error.code` and an `error.errno` for error handling. These are aliases for error codes thrown by Node.js core.

- [Programmer errors][joyent-guide] are either thrown as soon as possible, or rejected with default `Error` with `error.message` for ease of troubleshooting.

List of error types:

- Because we maintain 100% coverage, see [test/main.js](https://github.com/node-fetch/node-fetch/blob/master/test/main.js) for a full list of custom `FetchError` types, as well as some of the common errors from Node.js

[joyent-guide]: https://www.joyent.com/node-js/production/design/errors#operational-errors-vs-programmer-errors
