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

import {Duplex, Readable} from 'stream';

class ZitiSocket extends Duplex {

    constructor() {
        super({objectMode: true});

        /**
            This is where we'll put any data returned from a Ziti connection
        */
        this.readableStream = new Readable();

        this.readableStream._read = function () {
        };

        /**
             The underlying Ziti Connection
            @private
            @type {string}
        */
        this.zitiConnection; // eslint-disable-line no-unused-expressions

        /**
            True when read buffer is full and calls to `push` return false.
            Additionally data will not be read off the socket until the user
            calls `read`.
            @private
            @type {boolean}
        */
        this._readingPaused = false;
    }

    NF_dial(service) {
        const self = this;
        return new Promise((resolve) => {
            if (self.zitiConnection) {
                resolve(self.zitiConnection);
            }
            else {
                window.ziti.NF_dial(
                    service,
                    (conn) => {
                        resolve(conn);
                    },
                    (data) => {
                        this.readableStream.push(data);
                    },
                );
            }
        });
    }

  /**
    Pushes the data onto the underlying Ziti connection by invoking the NF_write() function in the native addon.  The
    native addon expects incoming data to be of type Buffer.
   */
    NF_write(conn, buffer) {
        return new Promise((resolve) => {
            window.ziti.NF_write(
                conn, buffer,
                () => {
                    resolve();
                },
            );
        });
    }

    /**
        Connect to a Ziti service.
        @param {object} param
        @param {string} [param.host] the host to connect to. Default is localhost
        @param {number} param.port the port to connect to. Required.
        @return {ZitiSocket}
    */
    async connect(opts) {
        this.zitiConnection = await this.NF_dial(opts.host).catch((e) => console.log('connect Error: ', e.message)); // eslint-disable-line new-cap
    }

    _hasData() {
        const self = this;
        return new Promise((resolve) => {
            (function waitForData() {
                if (self.readableStream.readableLength > 0) return resolve();
                setTimeout(waitForData, 100);
            })();
        });
    }

    /**
        Performs data read events which are triggered under two conditions:
        1. underlying `readable` events emitted when there is new data
            available on the socket
        2. the consumer requested additional data
        @private
    */
    async _onReadable() {

        await this._hasData().catch((e) => console.log('inside ziti-socket.js _onReadable(), Error: ', e.message));  

        // Read all the data until one of two conditions is met
        // 1. there is nothing left to read on the socket
        // 2. reading is paused because the consumer is slow
        while (!this._readingPaused) {

            const data = this.readableStream.read();
            if (data === null) {
                break;
            }
            else {
                // Push the data into the read buffer and capture whether
                // we are hitting the back pressure limits
                let pushOk = this.push(data);
                // When the push fails, we need to pause the ability to read
                // messages because the consumer is getting backed up.
                if (!pushOk) this._readingPaused = true;
            }
        }
    }

    /**
        Implements the readable stream method `_read`. This method will
        flagged that reading is no longer paused since this method should
        only be called by a consumer reading data.
        @private
    */
    _read() {
        this._readingPaused = false;
        setImmediate(this._onReadable.bind(this));
    }

    /**
        Returna a Promise that will resolve _only_ after a Ziti connection has been established for this instance of ZitiSocket.
    */
    getZitiConnection() {
        const self = this;
        return new Promise((resolve) => {
            (function waitForConnected() {
                if (self.zitiConnection) return resolve(self.zitiConnection);
                setTimeout(waitForConnected, 10);
            })();
        });
    }

    /**
        Implements the writeable stream method `_write` by pushing the data onto the underlying Ziti connection.
        It is possible that this function is called before the Ziti connect has completed, so this function will (currently)
        await Ziti connection establishment (as opposed to buffering the data).
    */
    async _write(chunk, encoding, cb) {

        let buffer;

        if (typeof chunk === 'string' || chunk instanceof String) {
            buffer = Buffer.from(chunk, 'utf8');
        } else if (Buffer.isBuffer(chunk)) {
            buffer = chunk;
        } else {
            throw new Error('chunk type of [' + typeof chunk + '] is not a supported type');
        }
        if (buffer.length > 0) {
            const conn = await this.getZitiConnection().catch((e) => console.log('inside ziti-socket.js _write(), Error 1: ', e.message));
            await this.NF_write(conn, buffer).catch((e) => console.log('_write(), Error 2: ', e.message)); // eslint-disable-line new-cap
        }
        cb();
    }

    /**
        Implements the writeable stream method `_final` used when
        .end() is called to write the final data to the stream.
    */
    _final(cb) {
        cb();
    }
}

export default ZitiSocket;
