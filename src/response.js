
/**
 * response.js
 *
 * Response class provides content decoding
 */

import { STATUS_CODES } from 'http';
import Headers from './headers.js';
import Body, { clone } from './body';

/**
 * Response class
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
export default class Response extends Body {
	constructor(body, opts = {}) {
		super(body, opts);

		this.url = opts.url;
		this.status = opts.status || 200;
		this.statusText = opts.statusText || STATUS_CODES[this.status];
		this.headers = new Headers(opts.headers);
	}

	/**
	 * Convenience property representing if the request ended normally
	 */
	get ok() {
		return this.status >= 200 && this.status < 300;
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

	/**
	 * Tag used by `Object.prototype.toString()`.
	 */
	get [Symbol.toStringTag]() {
		return 'Response';
	}
}
