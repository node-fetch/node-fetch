
var http = require('http');
var parse = require('url').parse;
var zlib = require('zlib');
var stream = require('stream');

module.exports = TestServer;

function TestServer() {
	this.server = http.createServer(this.router);
	this.port = 30001;
	this.hostname = 'localhost';
	this.server.on('error', function(err) {
		console.log(err.stack);
	});
}

TestServer.prototype.start = function(cb) {
	this.server.listen(this.port, this.hostname, cb);
}

TestServer.prototype.stop = function(cb) {
	this.server.close(cb);
}

TestServer.prototype.router = function(req, res) {

	var p = parse(req.url).pathname;

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
		zlib.gzip('hello world', function(err, buffer) {
			res.end(buffer);
		});
	}

	if (p === '/deflate') {
		res.statusCode = 200;
		res.setHeader('Content-Type', 'text/plain');
		res.setHeader('Content-Encoding', 'deflate');
		zlib.deflate('hello world', function(err, buffer) {
			res.end(buffer);
		});
	}

	if (p === '/timeout') {
		setTimeout(function() {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.end('text');
		}, 1000);
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

	if (p === '/inspect') {
		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json');
		var body = '';
		req.on('data', function(c) { body += c });
		req.on('end', function() {
			res.end(JSON.stringify({
				method: req.method,
				url: req.url,
				headers: req.headers,
				body: body
			}));
		});
	}

}
