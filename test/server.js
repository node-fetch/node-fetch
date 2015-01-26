
var http = require('http');
var parse = require('url').parse;

module.exports = TestServer;

function TestServer() {
	this.server = http.createServer(this.router);
	this.port = 30001;
	this.hostname = '127.0.0.1';
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

}
