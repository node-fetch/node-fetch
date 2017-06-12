
/**
 * body.js
 *
 * Body interface provides common methods for Request and Response
 */

import {convert} from 'encoding';
import Stream, {PassThrough} from 'stream';
import Blob, {BUFFER} from './blob.js';
import FetchError from './fetch-error.js';

const DISTURBED = Symbol('disturbed');

/**
 * Body class
 *
 * Cannot use ES6 class because Body must be called with .call().
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
		// body is undefined or null
		body = null;
	} else if (typeof body === 'string') {
		// body is string
	} else if (isURLSearchParams(body)) {
		// body is a URLSearchParams
	} else if (body instanceof Blob) {
		// body is blob
	} else if (Buffer.isBuffer(body)) {
		// body is buffer
	} else if (body instanceof Stream) {
		// body is stream
	} else {
		// none of the above
		// coerce to string
		body = String(body);
	}
	this.body = body;
	this[DISTURBED] = false;
	this.size = size;
	this.timeout = timeout;
}

Body.prototype = {
	get bodyUsed() {
		return this[DISTURBED];
	},

	/**
	 * Decode response as ArrayBuffer
	 *
	 * @return  Promise
	 */
	arrayBuffer() {
		return consumeBody.call(this).then(buf => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
	},

	/**
	 * Return raw response as Blob
	 *
	 * @return Promise
	 */
	blob() {
		let ct = this.headers && this.headers.get('content-type') || '';
		return consumeBody.call(this).then(buf => Object.assign(
			// Prevent copying
			new Blob([], {
				type: ct.toLowerCase()
			}),
			{
				[BUFFER]: buf
			}
		));
	},

	/**
	 * Decode response as json
	 *
	 * @return  Promise
	 */
	json() {
		return consumeBody.call(this).then(buffer => JSON.parse(buffer.toString()));
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
	},


};

Body.mixIn = function (proto) {
	for (const name of Object.getOwnPropertyNames(Body.prototype)) {
		// istanbul ignore else: future proof
		if (!(name in proto)) {
			const desc = Object.getOwnPropertyDescriptor(Body.prototype, name);
			Object.defineProperty(proto, name, desc);
		}
	}
};

/**
 * Decode buffers into utf-8 string
 *
 * @return  Promise
 */
function consumeBody(body) {
	if (this[DISTURBED]) {
		return Body.Promise.reject(new Error(`body used already for: ${this.url}`));
	}

	this[DISTURBED] = true;

	// body is null
	if (this.body === null) {
		return Body.Promise.resolve(new Buffer(0));
	}

	// body is string
	if (typeof this.body === 'string') {
		return Body.Promise.resolve(new Buffer(this.body));
	}

	// body is blob
	if (this.body instanceof Blob) {
		return Body.Promise.resolve(this.body[BUFFER]);
	}

	// body is buffer
	if (Buffer.isBuffer(this.body)) {
		return Body.Promise.resolve(this.body);
	}

	// istanbul ignore if: should never happen
	if (!(this.body instanceof Stream)) {
		return Body.Promise.resolve(new Buffer(0));
	}

	// body is stream
	// get ready to actually consume the body
	let accum = [];
	let accumBytes = 0;
	let abort = false;

	return new Body.Promise((resolve, reject) => {
		let resTimeout;

		// allow timeout on slow response body
		if (this.timeout) {
			resTimeout = setTimeout(() => {
				abort = true;
				reject(new FetchError(`Response timeout while trying to fetch ${this.url} (over ${this.timeout}ms)`, 'body-timeout'));
			}, this.timeout);
		}

		// handle stream error, such as incorrect content-encoding
		this.body.on('error', err => {
			reject(new FetchError(`Invalid response body while trying to fetch ${this.url}: ${err.message}`, 'system', err));
		});

		this.body.on('data', chunk => {
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

		this.body.on('end', () => {
			if (abort) {
				return;
			}

			clearTimeout(resTimeout);
			resolve(Buffer.concat(accum));
		});
	});
}

/**
 * Detect buffer encoding and convert to target encoding
 * ref: http://www.w3.org/TR/2011/WD-html5-20110113/parsing.html#determining-the-character-encoding
 *
 * @param   Buffer  buffer    Incoming buffer
 * @param   String  encoding  Target encoding
 * @return  String
 */
function convertBody(buffer, headers) {
	const ct = headers.get('content-type');
	let charset = 'utf-8';
	let res, str;

	// header
	if (ct) {
		res = /charset=([^;]*)/i.exec(ct);
	}

	// no charset in content type, peek at response body for at most 1024 bytes
	str = buffer.slice(0, 1024).toString();

	// html5
	if (!res && str) {
		res = /<meta.+?charset=(['"])(.+?)\1/i.exec(str);
	}

	// html4
	if (!res && str) {
		res = /<meta[\s]+?http-equiv=(['"])content-type\1[\s]+?content=(['"])(.+?)\2/i.exec(str);

		if (res) {
			res = /charset=(.*)/i.exec(res.pop());
		}
	}

	// xml
	if (!res && str) {
		res = /<\?xml.+?encoding=(['"])(.+?)\1/i.exec(str);
	}

	// found charset
	if (res) {
		charset = res.pop();

		// prevent decode issues when sites use incorrect encoding
		// ref: https://hsivonen.fi/encoding-menu/
		if (charset === 'gb2312' || charset === 'gbk') {
			charset = 'gb18030';
		}
	}

	// turn raw buffers into a single utf-8 buffer
	return convert(
		buffer
		, 'UTF-8'
		, charset
	).toString();
}

/**
 * Detect a URLSearchParams object
 * ref: https://github.com/bitinn/node-fetch/issues/296#issuecomment-307598143
 *
 * @param   Object  obj     Object to detect by type or brand
 * @return  String
 */
function isURLSearchParams(obj) {
    // Duck-typing as a necessary condition.
    if (typeof obj !== 'object' ||
        typeof obj.append !== 'function' ||
        typeof obj.delete !== 'function' ||
        typeof obj.get !== 'function' ||
        typeof obj.getAll !== 'function' ||
        typeof obj.has !== 'function' ||
        typeof obj.set !== 'function') {
        return false;
    }

    // Brand-checking and more duck-typing as optional condition.
    return obj.constructor.name === 'URLSearchParams' ||
        Object.prototype.toString.call(obj) === '[object URLSearchParams]' ||
        typeof obj.sort === 'function';
}

/**
 * Clone body given Res/Req instance
 *
 * @param   Mixed  instance  Response or Request instance
 * @return  Mixed
 */
export function clone(instance) {
	let p1, p2;
	let body = instance.body;

	// don't allow cloning a used body
	if (instance.bodyUsed) {
		throw new Error('cannot clone body after it is used');
	}

	// check that body is a stream and not form-data object
	// note: we can't clone the form-data object without having it as a dependency
	if ((body instanceof Stream) && (typeof body.getBoundary !== 'function')) {
		// tee instance body
		p1 = new PassThrough();
		p2 = new PassThrough();
		body.pipe(p1);
		body.pipe(p2);
		// set instance body to teed body and return the other teed body
		instance.body = p1;
		body = p2;
	}

	return body;
}

/**
 * Performs the operation "extract a `Content-Type` value from |object|" as
 * specified in the specification:
 * https://fetch.spec.whatwg.org/#concept-bodyinit-extract
 *
 * This function assumes that instance.body is present and non-null.
 *
 * @param   Mixed  instance  Response or Request instance
 */
export function extractContentType(instance) {
	const {body} = instance;

	// istanbul ignore if: Currently, because of a guard in Request, body
	// can never be null. Included here for completeness.
	if (body === null) {
		// body is null
		return null;
	} else if (typeof body === 'string') {
		// body is string
		return 'text/plain;charset=UTF-8';
	} else if (isURLSearchParams(body)) {
	 	// body is a URLSearchParams
		return 'application/x-www-form-urlencoded;charset=UTF-8';
	} else if (body instanceof Blob) {
		// body is blob
		return body.type || null;
	} else if (Buffer.isBuffer(body)) {
		// body is buffer
		return null;
	} else if (typeof body.getBoundary === 'function') {
		// detect form data input from form-data module
		return `multipart/form-data;boundary=${body.getBoundary()}`;
	} else {
		// body is stream
		// can't really do much about this
		return null;
	}
}

export function getTotalBytes(instance) {
	const {body} = instance;

	// istanbul ignore if: included for completion
	if (body === null) {
		// body is null
		return 0;
	} else if (typeof body === 'string') {
		// body is string
		return Buffer.byteLength(body);
	} else if (isURLSearchParams(body)) {
		// body is URLSearchParams
		return Buffer.byteLength(String(body));
	} else if (body instanceof Blob) {
		// body is blob
		return body.size;
	} else if (Buffer.isBuffer(body)) {
		// body is buffer
		return body.length;
	} else if (body && typeof body.getLengthSync === 'function') {
		// detect form data input from form-data module
		if (body._lengthRetrievers && body._lengthRetrievers.length == 0 || // 1.x
			body.hasKnownLength && body.hasKnownLength()) { // 2.x
			return body.getLengthSync();
		}
		return null;
	} else {
		// body is stream
		// can't really do much about this
		return null;
	}
}

export function writeToStream(dest, instance) {
	const {body} = instance;

	if (body === null) {
		// body is null
		dest.end();
	} else if (typeof body === 'string') {
		// body is string
		dest.write(body);
		dest.end();
	} else if (isURLSearchParams(body)) {
		// body is URLSearchParams
		dest.write(Buffer.from(String(body)));
		dest.end();
	} else if (body instanceof Blob) {
		// body is blob
		dest.write(body[BUFFER]);
		dest.end();
	} else if (Buffer.isBuffer(body)) {
		// body is buffer
		dest.write(body);
		dest.end()
	} else {
		// body is stream
		body.pipe(dest);
	}
}

// expose Promise
Body.Promise = global.Promise;
