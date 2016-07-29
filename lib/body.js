'use strict';

/**
 * body.js
 *
 * Body interface provides common methods for Request and Response
 */

var convert = require('encoding').convert;
var isNodeStream = require('is-stream');
var PassThrough = require('stream').PassThrough;
var FetchError = require('./fetch-error');
var webStreams = require('./web_streams');

module.exports = Body;

/**
 * Body class
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
function Body(body, opts) {

	opts = opts || {};

	this.body = body;
	if (isNodeStream(body) && !body.getBoundary) {
		// Node ReadableStream && not FormData. Convert to ReadableStream.
		this.body = webStreams.readable.nodeToWeb(body);
	}
	this._decodedBody = null;
	this.bodyUsed = false;
	this.size = opts.size || 0;
	this.timeout = opts.timeout || 0;
}

/**
 * Decode response as json
 *
 * @return  Promise
 */
Body.prototype.json = function() {

	return this._decode().then(function(text) {
		return JSON.parse(text);
	});

};

/**
 * Decode response as text
 *
 * @return  Promise
 */
Body.prototype.text = function() {
	if (typeof this.body === 'string' && !this.bodyUsed) {
		this.bodyUsed = true;
		return Promise.resolve(this.body);
	} else {
		return this._decode()
			.then(body => this._convert(body));
	}
};

/**
 * Decode response as a blob. We are using a Node Buffer, which is close
 * enough (for now).
 *
 * @return  Promise<Buffer>
 */
Body.prototype.blob = function() {
	if (Buffer.isBuffer(this._decodedBody) && !this.bodyUsed) {
		this.bodyUsed = true;
		return Promise.resolve(this._decodeBody);
	} else {
		return this._decode();
	}
};

/**
 * Return response body as an ArrayBuffer.
 *
 * @return  Promise<ArrayBuffer>
 */
Body.prototype.arrayBuffer = function() {
	return this._decode()
		// Convert to ArrayBuffer
		.then(body => body.buffer.slice(body.byteOffset,
					body.byteOffset + body.byteLength));
};

/**
 * Accumulate the body & return a Buffer.
 *
 * @return  Promise
 */
Body.prototype._decode = function() {

	var self = this;

	if (this.bodyUsed) {
		return Body.Promise.reject(new Error('body used already for: ' + this.url));
	}
	this.bodyUsed = true;

	let accum = [];
	let accumBytes = 0;

	return new Body.Promise(function(resolve, reject) {
		var resTimeout;

		if (typeof self.body === 'string') {
			self._decodedBody = new Buffer(self.body);
			return resolve(self._decodedBody);
		}

		if (self.body instanceof Buffer) {
			self._decodedBody = self.body;
			return resolve(self._decodedBody);
		}


		var reader = self.body.getReader();

		// allow timeout on slow response body
		if (self.timeout) {
			resTimeout = setTimeout(function() {
				reader.cancel();
				reject(new FetchError('response timeout at ' + self.url + ' over limit: ' + self.timeout, 'body-timeout'));
			}, self.timeout);
		}

		function pump() {
			return reader.read()
				.then(res => {
					if (res.done) {
						clearTimeout(resTimeout);
						// Make sure all elements are indeed buffers
						for (var i = 0; i < accum.length; i++) {
							let chunk = accum[i];
							if (!Buffer.isBuffer(chunk)) {
								accum[i] = new Buffer('' + chunk);
							}
						}
						self._decodedBody = Buffer.concat(accum);
						return self._decodedBody;
					}
					const chunk = res.value;
					accum.push(chunk);
					accumBytes += chunk.length;
					if (self.size && accumBytes > self.size) {
						reader.cancel();
						throw new FetchError('content size at ' + self.url + ' over limit: ' + self.size, 'max-size');
					}
					return pump();
				});
		}
		return pump().then(resolve, err => {
			if (err instanceof FetchError) {
				reject(err);
			} else {
				reject(new FetchError('invalid response body at: ' + self.url
						+ ' reason: ' + err.message, 'system', err));
			}
		});
	});

};

/**
 * Detect buffer encoding and convert to target encoding
 * ref: http://www.w3.org/TR/2011/WD-html5-20110113/parsing.html#determining-the-character-encoding
 *
 * @param   String  encoding  Target encoding
 * @return  String
 */
Body.prototype._convert = function(body, encoding) {

	encoding = encoding || 'utf-8';

	var charset = 'utf-8';
	var res, str;

	// header
	if (this.headers.has('content-type')) {
		res = /charset=([^;]*)/i.exec(this.headers.get('content-type'));
	}

	// no charset in content type, peek at response body for at most 1024 bytes
	if (!res && body.length > 0) {
        str = body.slice(0, 1024).toString();
	}

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
	if (encoding !== charset) {
		// turn raw buffers into utf-8 string
		return convert(body, encoding, charset).toString();
	} else {
		return body.toString(charset);
	}
};

/**
 * Clone body given Res/Req instance
 *
 * @param   Mixed  instance  Response or Request instance
 * @return  Mixed
 */
Body.prototype._clone = function(instance) {
	var p1, p2;
	var body = instance.body;

	// don't allow cloning a used body
	if (instance.bodyUsed) {
		throw new Error('cannot clone body after it is used');
	}

	// check that body is a stream and not form-data object
	// note: we can't clone the form-data object without having it as a dependency
	if (body instanceof ReadableStream && typeof body.getBoundary !== 'function') {
		let streams = instance.body.tee();
		instance.body = streams[0];
		body = streams[1];
	}

	return body;
}

// expose Promise
Body.Promise = global.Promise;
