/**
 * Response.js
 *
 * Response class provides content decoding
 */

import Headers from './headers';
import Body, {clone, extractContentType} from './body';

const INTERNALS = Symbol('Response internals');

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

		const status = opts.status || 200;
		const headers = new Headers(opts.headers);

		if (body !== null && !headers.has('Content-Type')) {
			const contentType = extractContentType(body);
			if (contentType) {
				headers.append('Content-Type', contentType);
			}
		}

		this[INTERNALS] = {
			url: opts.url,
			status,
			statusText: opts.statusText || '',
			headers,
			counter: opts.counter,
			highWaterMark: opts.highWaterMark,
			trailer: Promise.resolve(opts.trailer || new Headers())
		};
	}

	get trailer() {
		return this[INTERNALS].trailer;
	}

	get url() {
		return this[INTERNALS].url || '';
	}

	get status() {
		return this[INTERNALS].status;
	}

	/**
	 * Convenience property representing if the request ended normally
	 */
	get ok() {
		return this[INTERNALS].status >= 200 && this[INTERNALS].status < 300;
	}

	get redirected() {
		return this[INTERNALS].counter > 0;
	}

	get statusText() {
		return this[INTERNALS].statusText;
	}

	get headers() {
		return this[INTERNALS].headers;
	}

	get highWaterMark() {
		return this[INTERNALS].highWaterMark;
	}

	/**
	 * Clone this response
	 *
	 * @return  Response
	 */
	clone() {
		return new Response(clone(this, this.highWaterMark), {
			url: this.url,
			status: this.status,
			statusText: this.statusText,
			headers: this.headers,
			ok: this.ok,
			redirected: this.redirected,
			size: this.size,
			timeout: this.timeout,
			trailer: this.trailer
		});
	}
}

Body.mixIn(Response.prototype);

Object.defineProperties(Response.prototype, {
	url: {enumerable: true},
	status: {enumerable: true},
	ok: {enumerable: true},
	redirected: {enumerable: true},
	statusText: {enumerable: true},
	headers: {enumerable: true},
	clone: {enumerable: true}
});

Object.defineProperty(Response.prototype, Symbol.toStringTag, {
	value: 'Response',
	writable: false,
	enumerable: false,
	configurable: true
});
