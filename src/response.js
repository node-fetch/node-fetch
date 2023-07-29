/**
 * Response.js
 *
 * Response class provides content decoding
 */

import Headers from './headers.js';
import Body, {clone, extractContentType} from './body.js';
import {isRedirect} from './utils/is-redirect.js';

const INTERNALS = Symbol('Response internals');

/**
 * Checks the provided 'status' property to the Response constructor
 * @param {*} status
 * @throws RangeError if the status variable is not in the acceptable range of [200, 599]
 * @returns The provided status value if it is valid
 */
function validateStatusValue(status) {
	const statusValue = Number.parseInt(status, 10);

	if (Number.isNaN(statusValue) || statusValue < 200 || statusValue > 599) {
		throw new RangeError(`Failed to construct 'Response': The status provided (${status}) is outside the range [200, 599].`);
	}

	return statusValue;
};

/**
 * Response class
 *
 * Ref: https://fetch.spec.whatwg.org/#response-class
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
export default class Response extends Body {
	constructor(body = null, options = {}) {
		super(body, options);

		// if status is not provided or is null, let's use default 200 value
		// otherwise, lets check if the value is in correct range
		const status =	(typeof options.status === 'undefined' || options.status === null) ? 200 :
			validateStatusValue(options.status);

		const headers = new Headers(options.headers);

		if (status === 204 && typeof body !== 'undefined' && body !== null) {
				throw new TypeError("Failed to construct 'Response': Response with null body status cannot have body")
		}

		if (body !== null && !headers.has('Content-Type')) {			
			const contentType = extractContentType(body, this);
			if (contentType) {
				headers.append('Content-Type', contentType);
			}
		}

		this[INTERNALS] = {
			type: 'default',
			url: options.url,
			status,
			statusText: options.statusText || '',
			headers,
			counter: options.counter,
			highWaterMark: options.highWaterMark
		};
	}

	get type() {
		return this[INTERNALS].type;
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
			type: this.type,
			url: this.url,
			status: this.status,
			statusText: this.statusText,
			headers: this.headers,
			ok: this.ok,
			redirected: this.redirected,
			size: this.size,
			highWaterMark: this.highWaterMark
		});
	}

	/**
	 * @param {string} url    The URL that the new response is to originate from.
	 * @param {number} status An optional status code for the response (e.g., 302.)
	 * @returns {Response}    A Response object.
	 */
	static redirect(url, status = 302) {
		if (!isRedirect(status)) {
			throw new RangeError('Failed to execute "redirect" on "response": Invalid status code');
		}

		return new Response(null, {
			headers: {
				location: new URL(url).toString()
			},
			status
		});
	}

	static error() {
		// default error status code = 400
		const response = new Response(null, {status: 400, statusText: ''});
		response[INTERNALS].type = 'error';
		return response;
	}

	static json(data = undefined, init = {}) {
		const body = JSON.stringify(data);

		if (body === undefined) {
			throw new TypeError('data is not JSON serializable');
		}

		const headers = new Headers(init && init.headers);

		if (!headers.has('content-type')) {
			headers.set('content-type', 'application/json');
		}

		return new Response(body, {
			...init,
			headers
		});
	}

	get [Symbol.toStringTag]() {
		return 'Response';
	}
}

Object.defineProperties(Response.prototype, {
	type: {enumerable: true},
	url: {enumerable: true},
	status: {enumerable: true},
	ok: {enumerable: true},
	redirected: {enumerable: true},
	statusText: {enumerable: true},
	headers: {enumerable: true},
	clone: {enumerable: true}
});
