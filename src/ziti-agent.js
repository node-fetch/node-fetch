/*
Copyright 2019-2020 Netfoundry, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

var tls = require('tls');
var url = require('url');
import {inherits} from 'util';
import {EventEmitter} from 'events';
import ZitiSocket from './ziti-socket';

/**
 * Module exports.
 */

export default ZitiAgent;


/**
 * Base HTTP "ZitiAgent" class. Emulates the node-core `http.Agent` class, but
 * implemented in a way that can be extended for additional functionality.
 *
 *
 * @api public
 */

function ZitiAgent (opts) {

    if (!(this instanceof ZitiAgent)) return new ZitiAgent(opts);
    if ('string' == typeof opts) opts = url.parse(opts);
    // Agent.call(this);
    this.proxy = opts;
    this.secure = this.proxy.protocol && this.proxy.protocol === 'https:';
    EventEmitter.call(this);

}

inherits(ZitiAgent, EventEmitter);

/**
 * Default port to connect to.
 */

ZitiAgent.prototype.defaultPort = 443;

/**
 * Called when creating a new HTTP request with this ZitiAgent instance.
 *
 * @api public
 */

ZitiAgent.prototype.addRequest = function(req, host, port, localAddress) {

    let opts;
    if (typeof host == 'object') {
        // >= v0.11.x API
        opts = host;
    } else {
        // <= v0.10.x API
        opts = {
            host,
            port,
            localAddress,
        };
    }

    // hint to use "Connection: close"
    req.shouldKeepAlive = false;

    // create the `ZitiSocket` instance
    const info = {
        host: opts.hostname || opts.host,
        port: Number(opts.port) || this.defaultPort,
        localAddress: opts.localAddress,
    };

    this.createConnection(info, (err, socket) => {
        if (err) {
            req.emit('error', err);
        } else {
            req.onSocket(socket);
        }
    });
}



/**
 * Creates and returns a `ZitiSocket` instance to use for an HTTP request.
 *
 * @api public
 */

ZitiAgent.prototype.createConnection = function(opts, fn) {
    const socket = new ZitiSocket();
    socket.connect(opts);
    fn(null, socket);
    return socket;
};
