
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

- Operational errors can surface as different error classes depending on where they happen.

  - `AbortError` when the request is cancelled.
  - `FetchError` for network/stream/redirect failures created by node-fetch.
  - `TypeError`, `RangeError`, `SyntaxError`, or generic `Error` for validation and parsing failures (for example invalid init options, invalid redirect URL handling, or invalid JSON).

- All errors come with an `error.message` describing the cause.

- `FetchError` instances created by `node-fetch` include a custom `error.type`.

- `FetchError` instances that wrap Node.js core I/O failures use `error.type = 'system'` and include `error.code` and `error.errno` from Node.js.

- [Programmer errors][joyent-guide] are thrown as soon as possible (or rejected) with standard JavaScript errors to make troubleshooting easier.

List of error types:

- For currently covered cases and `FetchError` type strings, see [test/main.js](https://github.com/node-fetch/node-fetch/blob/master/test/main.js).

[joyent-guide]: https://www.joyent.com/node-js/production/design/errors#operational-errors-vs-programmer-errors
