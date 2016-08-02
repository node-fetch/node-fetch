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
        this.bodyUsed = false;
        this.size = opts.size || 0;
        this.timeout = opts.timeout || 0;
        this.url = opts.url;
    }

    get body() {
        const rawBody = this._rawBody;
        if (!rawBody) {
            return null;
        } else if (rawBody instanceof webStreams.ReadableStream) {
            return rawBody;
        } else if (typeof rawBody === 'string'
                || Buffer.isBuffer(rawBody)
                || isNodeStream(rawBody) && rawBody.readable && !rawBody.getBoundary) {
            // Convert to ReadableStream.
            this._rawBody = webStreams.toWebReadableStream(rawBody);
            return this._rawBody;
        } else if (rawBody && rawBody.getBoundary) {
            // FormData instance. Make an exception, for now.
            return rawBody;
        } else {
            throw new TypeError(`Unsupported Response body type: ${typeof body}`);
        }
    }

    set body(val) {
        this._rawBody = val;
    }

    /**
     * Decode response as json
     *
     * @return  Promise
     */
    json() {
        return this._consumeBody().then(text => JSON.parse(text));
    }

    /**
     * Decode response as text
     *
     * @return  Promise
     */
    text() {
        if (typeof this._rawBody === 'string' && !this.bodyUsed) {
            this.bodyUsed = true;
            return Promise.resolve(this._rawBody);
        } else {
            return this._consumeBody().then(body => body.toString());
        }
    }

    /**
     * Decode response as a blob. We are using a Node Buffer, which is close
     * enough (for now).
     *
     * @return  Promise<Buffer>
     */
    blob() {
        if (Buffer.isBuffer(this._rawBody) && !this.bodyUsed) {
            this.bodyUsed = true;
            return Promise.resolve(this._rawBody);
        } else {
            return this._consumeBody();
        }
    }

    /**
     * Return response body as an ArrayBuffer.
     *
     * @return  Promise<ArrayBuffer>
     */
    arrayBuffer() {
        return this._consumeBody()
            // Convert to ArrayBuffer
            .then(body => body.buffer.slice(body.byteOffset,
                        body.byteOffset + body.byteLength));
    }

    /**
     * Accumulate the body & return a Buffer.
     *
     * @return  Promise
     */
    _consumeBody() {

        const self = this;

        if (this.bodyUsed) {
            return Body.Promise.reject(new Error(`body used already for: ${this.url}`));
        }
        this.bodyUsed = true;
        if (Buffer.isBuffer(this._rawBody)) {
            return Promise.resolve(this._rawBody);
        } else if (typeof this._rawBody === 'string') {
            return Promise.resolve(new Buffer(this._rawBody));
        }

        // Get ready to actually consume the body
        let accum = [];
        let accumBytes = 0;
        return new Body.Promise((resolve, reject) => {
            let resTimeout;

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
                            self._rawBody = Buffer.concat(accum);
                            return self._rawBody;
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
