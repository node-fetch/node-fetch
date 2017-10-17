
/**
 * response.js
 *
 * Response class provides content decoding
 */

import Headers from './headers.js';
import Body, { clone } from './body';

const { STATUS_CODES } = require('http');

/**
 * Response class
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
export default class Response {
	constructor(body = null, opts = {}) {
		Body.call(this, body, opts);

		const url = opts.url;
		const status = opts.status || 200;
		const statusText = opts.statusText || STATUS_CODES[status];
		const headers = new Headers(opts.headers);

		Object.defineProperties(this, {
			url: {
				get() { return url },
				set() {},
				enumerable: true,
			},
			status: {
				get() { return status },
				set() {},
				enumerable: true,
			},
			statusText: {
				get() { return statusText },
				set() {},
				enumerable: true,
			},
			headers: {
				get() { return headers; },
				set() {},
				enumerable: true,
			},
			ok: {
				get() { return this.status >= 200 && this.status < 300},
				set() {},
				enumerable: true,
			}
		});

		Object.defineProperty(this, Symbol.toStringTag, {
			value: 'Response',
			writable: false,
			enumerable: false,
			configurable: true
		});

		return Object.create(this);
	}

	/**
	 * Clone this response
	 *
	 * @return  Response
	 */
	clone() {

		return new Response(clone(this), {
			url: this.url
			, status: this.status
			, statusText: this.statusText
			, headers: this.headers
			, ok: this.ok
		});

	}
}

Body.mixIn(Response.prototype);

Object.defineProperty(Response.prototype, Symbol.toStringTag, {
	value: 'ResponsePrototype',
	writable: false,
	enumerable: false,
	configurable: true
});
