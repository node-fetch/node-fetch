'use strict';

const convertEncoding = require('encoding').convert;
const isNodeStream = require('is-stream');
const PassThrough = require('stream').PassThrough;
const FetchError = require('./fetch-error');
const webStreams = require('node-web-streams');

/**
 * Body class
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
class Body {
    constructor(body, opts) {
		opts = opts || {};
        this._rawBody = body;
        this.body = body;
        if (body) {
            if (body instanceof webStreams.ReadableStream) {
                this.body = body;
            } else if (typeof body === 'string'
                    || Buffer.isBuffer(body)
                    || isNodeStream(body) && body.readable && !body.getBoundary) {
                // Node Readable && not FormData. Convert to ReadableStream.
                this.body = webStreams.toWebReadableStream(body);
            } else if (body && body.getBoundary) {
                // FormData instance. Make an exception, for now.
                this.body = body;
            } else {
                throw new TypeError(`Unsupported Response body type: ${typeof body}`);
            }
        }
        this._decodedBody = null;
        this.bodyUsed = false;
        this.size = opts.size || 0;
        this.timeout = opts.timeout || 0;
		this.url = opts.url;
    }

    /**
     * Decode response as json
     *
     * @return  Promise
     */
    json() {

        return this._decode().then(text => JSON.parse(text));

    }

    /**
     * Decode response as text
     *
     * @return  Promise
     */
    text() {
        if (this.bodyUsed) {
            return this._decode();
        }
        if (typeof this._rawBody === 'string') {
            this.bodyUsed = true;
            return Promise.resolve(this._convert(this._rawBody));
		} else if (this._decodedBody) {
            this.bodyUsed = true;
            return Promise.resolve(this._convert(this._decodedBody.toString()));
        } else {
            return this._decode()
                .then(body => this._convert(body));
        }
    }

    /**
     * Decode response as a blob. We are using a Node Buffer, which is close
     * enough (for now).
     *
     * @return  Promise<Buffer>
     */
    blob() {
        if (Buffer.isBuffer(this._decodedBody) && !this.bodyUsed) {
            this.bodyUsed = true;
            return Promise.resolve(this._decodedBody);
        } else {
            return this._decode();
        }
    }

    /**
     * Return response body as an ArrayBuffer.
     *
     * @return  Promise<ArrayBuffer>
     */
    arrayBuffer() {
        return this._decode()
            // Convert to ArrayBuffer
            .then(body => body.buffer.slice(body.byteOffset,
                        body.byteOffset + body.byteLength));
    }

    /**
     * Accumulate the body & return a Buffer.
     *
     * @return  Promise
     */
    _decode() {

        const self = this;

        if (this.bodyUsed) {
            return Body.Promise.reject(new Error(`body used already for: ${this.url}`));
        }
        this.bodyUsed = true;

        let accum = [];
        let accumBytes = 0;

        return new Body.Promise((resolve, reject) => {
            let resTimeout;

            if (typeof self.body === 'string') {
                self._decodedBody = new Buffer(self.body);
                return resolve(self._decodedBody);
            }

            if (self.body instanceof Buffer) {
                self._decodedBody = self.body;
                return resolve(self._decodedBody);
            }


            const reader = self.body.getReader();

            // allow timeout on slow response body
            if (self.timeout) {
                resTimeout = setTimeout(() => {
                    reader.cancel();
                    reject(new FetchError(`response timeout at ${self.url} over limit: ${self.timeout}`, 'body-timeout'));
                }, self.timeout);
            }

            function pump() {
                return reader.read()
                    .then(res => {
                        if (res.done) {
                            clearTimeout(resTimeout);
                            // Make sure all elements are indeed buffers
                            for (let i = 0; i < accum.length; i++) {
                                let chunk = accum[i];
                                if (!Buffer.isBuffer(chunk)) {
                                    accum[i] = new Buffer(`${chunk}`);
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
                            throw new FetchError(`content size at ${self.url} over limit: ${self.size}`, 'max-size');
                        }
                        return pump();
                    });
            }
            return pump().then(resolve, err => {
                if (err instanceof FetchError) {
                    reject(err);
                } else {
                    reject(new FetchError(`invalid response body at: ${self.url} reason: ${err.message}`, 'system', err));
                }
            });
        });

    }

    /**
     * Detect buffer encoding and convert to target encoding
     * ref: http://www.w3.org/TR/2011/WD-html5-20110113/parsing.html#determining-the-character-encoding
     *
     * @param   String  encoding  Target encoding
     * @return  String
     */
    _convert(body, encoding) {
		encoding = encoding || 'utf-8';
        let charset = 'utf-8';
        let res, str;

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
            return convertEncoding(body, encoding, charset).toString();
        } else {
            return body.toString(charset);
        }
    }

    /**
     * Clone body given Res/Req instance
     *
     * @param   Mixed  instance  Response or Request instance
     * @return  Mixed
     */
    static _clone(instance) {
        let p1, p2;
        let body = instance.body;

        // don't allow cloning a used body
        if (instance.bodyUsed) {
            throw new Error('cannot clone body after it is used');
        }

        // check that body is a stream and not form-data object
        // note: we can't clone the form-data object without having it as a dependency
        if (body instanceof webStreams.ReadableStream && typeof body.getBoundary !== 'function') {
            let streams = instance.body.tee();
            instance.body = streams[0];
            body = streams[1];
        }

        return body;
    }
}

// expose Promise
Body.Promise = global.Promise;

module.exports = Body
