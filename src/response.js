/**
 * Response.js
 *
 * Response class provides content decoding
 */

import Headers from './headers.js';
import Body, {clone, extractContentType} from './body.js';
import {isRedirect} from './utils/is-redirect.js';

const INTERNALS = Symbol('Response internals');
const NULL_BODY_STATUSES = new Set([101, 204, 304]);

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

		// eslint-disable-next-line no-eq-null, eqeqeq, no-negated-condition
		const status = options.status != null ? options.status : 200;

		// Validate status per fetch spec
		if (status < 200 || status > 599) {
			throw new RangeError(`Failed to construct 'Response': The status provided (${status}) is outside the range [200, 599].`);
		}

		if (options.statusText !== undefined) {
			// Validate statusText per fetch spec (reason-phrase token: HTAB, SP, VCHAR, obs-text)
			// Disallow CR, LF, and NUL
			if (/[\0\r\n]/.test(options.statusText)) {
				throw new TypeError('Failed to construct \'Response\': The status text provided contains invalid characters.');
			}
		}

		const headers = new Headers(options.headers);

		if (body !== null && body !== undefined) {
			if (NULL_BODY_STATUSES.has(status)) {
				throw new TypeError('Failed to construct \'Response\': Response with null body status cannot have body.');
			}

			if (!headers.has('Content-Type')) {
				const contentType = extractContentType(body, this);
				if (contentType) {
					headers.append('Content-Type', contentType);
				}
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
		const response = Reflect.construct(Response, [], Response);
		response[INTERNALS] = {
			type: 'error',
			url: '',
			status: 0,
			statusText: '',
			headers: new Headers(),
			counter: 0,
			highWaterMark: 0
		};
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
