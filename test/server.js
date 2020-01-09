import * as http from 'http';
import * as zlib from 'zlib';
import {multipart as Multipart} from 'parted';

export default class TestServer {
	constructor() {
		this.server = http.createServer(this.router);
		this.port = 30001;
		this.hostname = 'localhost';
		// Node 8 default keepalive timeout is 5000ms
		// make it shorter here as we want to close server quickly at the end of tests
		this.server.keepAliveTimeout = 1000;
		this.server.on('error', err => {
			console.log(err.stack);
		});
		this.server.on('connection', socket => {
			socket.setTimeout(1500);
		});
	}

	start(cb) {
		this.server.listen(this.port, this.hostname, cb);
	}

	stop(cb) {
		this.server.close(cb);
	}

	mockResponse(responseHandler) {
		this.server.nextResponseHandler = responseHandler;
		return `http://${this.hostname}:${this.port}/mocked`;
	}

	router(req, res) {
		const p = req.url;

		if (p === '/mocked') {
			if (this.nextResponseHandler) {
				this.nextResponseHandler(res);
				this.nextResponseHandler = undefined;
			} else {
				throw new Error('No mocked response. Use \'TestServer.mockResponse()\'.');
			}
		}

		if (p === '/hello') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.end('world');
		}

		if (p === '/plain') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.end('text');
		}

		if (p === '/options') {
			res.statusCode = 200;
			res.setHeader('Allow', 'GET, HEAD, OPTIONS');
			res.end('hello world');
		}

		if (p === '/html') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/html');
			res.end('<html></html>');
		}

		if (p === '/json') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify({
				name: 'value'
			}));
		}

		if (p === '/gzip') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.setHeader('Content-Encoding', 'gzip');
			zlib.gzip('hello world', (err, buffer) => {
				if (err) {
					throw err;
				}

				res.end(buffer);
			});
		}

		if (p === '/gzip-truncated') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.setHeader('Content-Encoding', 'gzip');
			zlib.gzip('hello world', (err, buffer) => {
				if (err) {
					throw err;
				}

				// Truncate the CRC checksum and size check at the end of the stream
				res.end(buffer.slice(0, buffer.length - 8));
			});
		}

		if (p === '/gzip-capital') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.setHeader('Content-Encoding', 'GZip');
			zlib.gzip('hello world', (err, buffer) => {
				if (err) {
					throw err;
				}

				res.end(buffer);
			});
		}

		if (p === '/deflate') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.setHeader('Content-Encoding', 'deflate');
			zlib.deflate('hello world', (err, buffer) => {
				if (err) {
					throw err;
				}

				res.end(buffer);
			});
		}

		if (p === '/brotli') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			if (typeof zlib.createBrotliDecompress === 'function') {
				res.setHeader('Content-Encoding', 'br');
				zlib.brotliCompress('hello world', (err, buffer) => {
					if (err) {
						throw err;
					}

					res.end(buffer);
				});
			}
		}

		if (p === '/deflate-raw') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.setHeader('Content-Encoding', 'deflate');
			zlib.deflateRaw('hello world', (err, buffer) => {
				if (err) {
					throw err;
				}

				res.end(buffer);
			});
		}

		if (p === '/sdch') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.setHeader('Content-Encoding', 'sdch');
			res.end('fake sdch string');
		}

		if (p === '/invalid-content-encoding') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.setHeader('Content-Encoding', 'gzip');
			res.end('fake gzip string');
		}

		if (p === '/timeout') {
			setTimeout(() => {
				res.statusCode = 200;
				res.setHeader('Content-Type', 'text/plain');
				res.end('text');
			}, 1000);
		}

		if (p === '/slow') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.write('test');
			setTimeout(() => {
				res.end('test');
			}, 1000);
		}

		if (p === '/cookie') {
			res.statusCode = 200;
			res.setHeader('Set-Cookie', ['a=1', 'b=1']);
			res.end('cookie');
		}

		if (p === '/size/chunk') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			setTimeout(() => {
				res.write('test');
			}, 10);
			setTimeout(() => {
				res.end('test');
			}, 20);
		}

		if (p === '/size/long') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.end('testtest');
		}

		if (p === '/redirect/301') {
			res.statusCode = 301;
			res.setHeader('Location', '/inspect');
			res.end();
		}

		if (p === '/redirect/302') {
			res.statusCode = 302;
			res.setHeader('Location', '/inspect');
			res.end();
		}

		if (p === '/redirect/303') {
			res.statusCode = 303;
			res.setHeader('Location', '/inspect');
			res.end();
		}

		if (p === '/redirect/307') {
			res.statusCode = 307;
			res.setHeader('Location', '/inspect');
			res.end();
		}

		if (p === '/redirect/308') {
			res.statusCode = 308;
			res.setHeader('Location', '/inspect');
			res.end();
		}

		if (p === '/redirect/chain') {
			res.statusCode = 301;
			res.setHeader('Location', '/redirect/301');
			res.end();
		}

		if (p === '/redirect/no-location') {
			res.statusCode = 301;
			res.end();
		}

		if (p === '/redirect/slow') {
			res.statusCode = 301;
			res.setHeader('Location', '/redirect/301');
			setTimeout(() => {
				res.end();
			}, 1000);
		}

		if (p === '/redirect/slow-chain') {
			res.statusCode = 301;
			res.setHeader('Location', '/redirect/slow');
			setTimeout(() => {
				res.end();
			}, 10);
		}

		if (p === '/redirect/slow-stream') {
			res.statusCode = 301;
			res.setHeader('Location', '/slow');
			res.end();
		}

		if (p === '/error/400') {
			res.statusCode = 400;
			res.setHeader('Content-Type', 'text/plain');
			res.end('client error');
		}

		if (p === '/error/404') {
			res.statusCode = 404;
			res.setHeader('Content-Encoding', 'gzip');
			res.end();
		}

		if (p === '/error/500') {
			res.statusCode = 500;
			res.setHeader('Content-Type', 'text/plain');
			res.end('server error');
		}

		if (p === '/error/reset') {
			res.destroy();
		}

		if (p === '/error/json') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json');
			res.end('invalid json');
		}

		if (p === '/no-content') {
			res.statusCode = 204;
			res.end();
		}

		if (p === '/no-content/gzip') {
			res.statusCode = 204;
			res.setHeader('Content-Encoding', 'gzip');
			res.end();
		}

		if (p === '/no-content/brotli') {
			res.statusCode = 204;
			res.setHeader('Content-Encoding', 'br');
			res.end();
		}

		if (p === '/not-modified') {
			res.statusCode = 304;
			res.end();
		}

		if (p === '/not-modified/gzip') {
			res.statusCode = 304;
			res.setHeader('Content-Encoding', 'gzip');
			res.end();
		}

		if (p === '/inspect') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json');
			let body = '';
			req.on('data', c => {
				body += c;
			});
			req.on('end', () => {
				res.end(JSON.stringify({
					method: req.method,
					url: req.url,
					headers: req.headers,
					body
				}));
			});
		}

		if (p === '/multipart') {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json');
			const parser = new Multipart(req.headers['content-type']);
			let body = '';
			parser.on('part', (field, part) => {
				body += field + '=' + part;
			});
			parser.on('end', () => {
				res.end(JSON.stringify({
					method: req.method,
					url: req.url,
					headers: req.headers,
					body
				}));
			});
			req.pipe(parser);
		}

		if (p === '/trailers') {
			res.statusCode = 200
			res.setHeader('Transfer-Encoding', 'chunked')
			res.setHeader('Trailer', 'X-Node-Fetch')
			res.write('Body of the response')
			res.addTrailers({ 'X-Node-Fetch': 'hello world!' })
			res.end()
		}
	}
}

if (require.main === module) {
	const server = new TestServer();
	server.start(() => {
		console.log(`Server started listening at port ${server.port}`);
	});
}
