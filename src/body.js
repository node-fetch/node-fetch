
/**
 * Body.js
 *
 * Body interface provides common methods for Request and Response
 */

import Stream, {PassThrough} from 'stream';

import Blob from 'fetch-blob';
import {convertBody} from 'fetch-charset-detection';
import FetchError from './errors/fetch-error';
import {isBlob, isURLSearchParams, isArrayBuffer, isAbortError} from './utils/is';

export {getTotalBytes, writeToStream, extractContentType} from 'fetch-charset-detection';

const INTERNALS = Symbol('Body internals');

/**
 * Body mixin
 *
 * Ref: https://fetch.spec.whatwg.org/#body
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
export default function Body(body, {
	size = 0,
	timeout = 0
} = {}) {
	if (body == null) {
		// Body is undefined or null
		body = null;
	} else if (isURLSearchParams(body)) {
		// Body is a URLSearchParams
		body = Buffer.from(body.toString());
	} else if (isBlob(body)) {
		// Body is blob
	} else if (Buffer.isBuffer(body)) {
		// Body is Buffer
	} else if (isArrayBuffer(body)) {
		// Body is ArrayBuffer
		body = Buffer.from(body);
	} else if (ArrayBuffer.isView(body)) {
		// Body is ArrayBufferView
		body = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
	} else if (body instanceof Stream) {
		// Body is stream
	} else {
		// None of the above
		// coerce to string then buffer
		body = Buffer.from(String(body));
	}

	this[INTERNALS] = {
		body,
		disturbed: false,
		error: null
	};
	this.size = size;
	this.timeout = timeout;

	if (body instanceof Stream) {
		body.on('error', err => {
			const error = isAbortError(err) ?
				err :
				new FetchError(`Invalid response body while trying to fetch ${this.url}: ${err.message}`, 'system', err);
			this[INTERNALS].error = error;
		});
	}
}

Body.prototype = {
	get body() {
		return this[INTERNALS].body;
	},

	get bodyUsed() {
		return this[INTERNALS].disturbed;
	},

	/**
	 * Decode response as ArrayBuffer
	 *
	 * @return  Promise
	 */
	arrayBuffer() {
		return consumeBody.call(this).then(({buffer, byteOffset, byteLength}) => buffer.slice(byteOffset, byteOffset + byteLength));
	},

	/**
	 * Return raw response as Blob
	 *
	 * @return Promise
	 */
	blob() {
		const ct = this.headers && this.headers.get('content-type') || this[INTERNALS].body && this[INTERNALS].body.type || '';
		return consumeBody.call(this).then(buf => new Blob([], {
			type: ct.toLowerCase(),
			buffer: buf
		}));
	},

	/**
	 * Decode response as json
	 *
	 * @return  Promise
	 */
	json() {
		return consumeBody.call(this).then(buffer => {
			try {
				return JSON.parse(buffer.toString());
			} catch (error) {
				return Body.Promise.reject(new FetchError(`invalid json response body at ${this.url} reason: ${error.message}`, 'invalid-json'));
			}
		});
	},

	/**
	 * Decode response as text
	 *
	 * @return  Promise
	 */
	text() {
		return consumeBody.call(this).then(buffer => buffer.toString());
	},

	/**
	 * Decode response as buffer (non-spec api)
	 *
	 * @return  Promise
	 */
	buffer() {
		return consumeBody.call(this);
	},

	/**
	 * Decode response as text, while automatically detecting the encoding and
	 * trying to decode to UTF-8 (non-spec api)
	 *
	 * @return  Promise
	 */
	textConverted() {
		return consumeBody.call(this).then(buffer => convertBody(buffer, this.headers));
	}
};

// In browsers, all properties are enumerable.
Object.defineProperties(Body.prototype, {
	body: {enumerable: true},
	bodyUsed: {enumerable: true},
	arrayBuffer: {enumerable: true},
	blob: {enumerable: true},
	json: {enumerable: true},
	text: {enumerable: true}
});

Body.mixIn = proto => {
	for (const name of Object.getOwnPropertyNames(Body.prototype)) {
		// istanbul ignore else: future proof
		if (!(name in proto)) {
			const desc = Object.getOwnPropertyDescriptor(Body.prototype, name);
			Object.defineProperty(proto, name, desc);
		}
	}
};

/**
 * Consume and convert an entire Body to a Buffer.
 *
 * Ref: https://fetch.spec.whatwg.org/#concept-body-consume-body
 *
 * @return  Promise
 */
function consumeBody() {
	if (this[INTERNALS].disturbed) {
		return Body.Promise.reject(new TypeError(`body used already for: ${this.url}`));
	}

	this[INTERNALS].disturbed = true;

	if (this[INTERNALS].error) {
		return Body.Promise.reject(this[INTERNALS].error);
	}

	let {body} = this;

	// Body is null
	if (body === null) {
		return Body.Promise.resolve(Buffer.alloc(0));
	}

	// Body is blob
	if (isBlob(body)) {
		body = body.stream();
	}

	// Body is buffer
	if (Buffer.isBuffer(body)) {
		return Body.Promise.resolve(body);
	}

	// istanbul ignore if: should never happen
	if (!(body instanceof Stream)) {
		return Body.Promise.resolve(Buffer.alloc(0));
	}

	// Body is stream
	// get ready to actually consume the body
	const accum = [];
	let accumBytes = 0;
	let abort = false;

	return new Body.Promise((resolve, reject) => {
		let resTimeout;

		// Allow timeout on slow response body
		if (this.timeout) {
			resTimeout = setTimeout(() => {
				abort = true;
				reject(new FetchError(`Response timeout while trying to fetch ${this.url} (over ${this.timeout}ms)`, 'body-timeout'));
			}, this.timeout);
		}

		// Handle stream errors
		body.on('error', err => {
			if (isAbortError(err)) {
				// If the request was aborted, reject with this Error
				abort = true;
				reject(err);
			} else {
				// Other errors, such as incorrect content-encoding
				reject(new FetchError(`Invalid response body while trying to fetch ${this.url}: ${err.message}`, 'system', err));
			}
		});

		body.on('data', chunk => {
			if (abort || chunk === null) {
				return;
			}

			if (this.size && accumBytes + chunk.length > this.size) {
				abort = true;
				reject(new FetchError(`content size at ${this.url} over limit: ${this.size}`, 'max-size'));
				return;
			}

			accumBytes += chunk.length;
			accum.push(chunk);
		});

		body.on('end', () => {
			if (abort) {
				return;
			}

			clearTimeout(resTimeout);

			try {
				resolve(Buffer.concat(accum, accumBytes));
			} catch (error) {
				// Handle streams that have accumulated too much data (issue #414)
				reject(new FetchError(`Could not create Buffer from response body for ${this.url}: ${error.message}`, 'system', error));
			}
		});
	});
}

/**
 * Clone body given Res/Req instance
 *
 * @param   Mixed   instance       Response or Request instance
 * @param   String  highWaterMark  highWaterMark for both PassThrough body streams
 * @return  Mixed
 */
export function clone(instance, highWaterMark) {
	let p1;
	let p2;
	let {body} = instance;

	// Don't allow cloning a used body
	if (instance.bodyUsed) {
		throw new Error('cannot clone body after it is used');
	}

	// Check that body is a stream and not form-data object
	// note: we can't clone the form-data object without having it as a dependency
	if ((body instanceof Stream) && (typeof body.getBoundary !== 'function')) {
		// Tee instance body
		p1 = new PassThrough({highWaterMark});
		p2 = new PassThrough({highWaterMark});
		body.pipe(p1);
		body.pipe(p2);
		// Set instance body to teed body and return the other teed body
		instance[INTERNALS].body = p1;
		body = p2;
	}

	return body;
}

// Expose Promise
Body.Promise = global.Promise;
