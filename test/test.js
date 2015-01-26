
// test tools
var chai = require('chai');
var cap = require('chai-as-promised');
chai.use(cap);
var expect = chai.expect;
var http = require('http');
var https = require('https');
var bluebird = require('bluebird');
var then = require('promise');

// test subjects
var fetch = require('../index.js');
// test with native promise on node 0.11, and bluebird for node 0.10
fetch.Promise = fetch.Promise || bluebird;

var url, opts, local;

describe('Fetch', function() {

	before(function(done) {
		// TODO: create a server instance for testing
		local = http.createServer(function(req, res) {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.write('hello world');
			res.end();
		});
		local.listen(30001, done);
	});

	after(function(done) {
		local.close(done);
	});

	it('should return a promise', function() {
		url = 'http://example.com/';
		expect(fetch(url)).to.be.an.instanceof(fetch.Promise);
	});

	it('should custom promise', function() {
		url = 'http://example.com/';
		var old = fetch.Promise;
		fetch.Promise = then;
		expect(fetch(url)).to.be.an.instanceof(then);
		fetch.Promise = old;
	});

	it('should reject with error if url is relative', function() {
		url = 'some/path';
		return expect(fetch(url)).to.eventually.be.rejectedWith(Error);
	});

	it('should reject with error if protocol is unsupported', function() {
		url = 'ftp://example.com/';
		return expect(fetch(url)).to.eventually.be.rejectedWith(Error);
	});

	it('should resolve with result', function() {
		url = 'http://127.0.0.1:30001/';
		return fetch(url).then(function(res) {
			expect(res.status).to.equal(200);
			expect(res.headers).to.include({ 'content-type': 'text/plain' });
		});
	});
});
