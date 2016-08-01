'use strict';

const http = require('http');
const Headers = require('./headers');
const Body = require('./body');

/**
 * Response class
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
class Response extends Body {
    constructor(body, opts) {
        opts = opts || {};
        super(body, opts);
        this.url = opts.url;
        this.status = opts.status || 200;
        this.statusText = opts.statusText || http.STATUS_CODES[this.status];
        this.headers = new Headers(opts.headers);
        this.ok = this.status >= 200 && this.status < 300;
    }

    /**
     * Clone this response
     *
     * @return  Response
     */
    clone() {
        return new Response(Body._clone(this), {
            url: this.url
                , status: this.status
                , statusText: this.statusText
                , headers: this.headers
                , ok: this.ok
        });
    }
}

module.exports = Response;
