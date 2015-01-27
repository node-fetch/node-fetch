
// test tools
var chai = require('chai');
var cap = require('chai-as-promised');
chai.use(cap);
var expect = chai.expect;
var bluebird = require('bluebird');
var then = require('promise');
var stream = require('stream');
var resumer = require('resumer');

var TestServer = require('./server');

// test subjects
var fetch = require('../index.js');
var Headers = require('../lib/headers.js');
var Response = require('../lib/response.js');
// test with native promise on node 0.11, and bluebird for node 0.10
fetch.Promise = fetch.Promise || bluebird;

var url, opts, local, base;

describe('node-fetch', function() {

	before(function(done) {
		local = new TestServer();
		base = 'http://' + local.hostname + ':' + local.port;
		local.start(done);
	});

	after(function(done) {
		local.stop(done);
	});

	it('should return a promise', function() {
		url = 'http://example.com/';
		var p = fetch(url);
		expect(p).to.be.an.instanceof(fetch.Promise);
		expect(p).to.have.property('then');
	});

	it('should allow custom promise', function() {
		url = 'http://example.com/';
		var old = fetch.Promise;
		fetch.Promise = then;
		expect(fetch(url)).to.be.an.instanceof(then);
		expect(fetch(url)).to.not.be.an.instanceof(bluebird);
		fetch.Promise = old;
	});

	it('should throw error when no promise implementation are found', function() {
		url = 'http://example.com/';
		var old = fetch.Promise;
		fetch.Promise = undefined;
		expect(function() {
			fetch(url)
		}).to.throw(Error);
		fetch.Promise = old;
	});

	it('should reject with error if url is protocol relative', function() {
		url = '//example.com/';
		return expect(fetch(url)).to.eventually.be.rejectedWith(Error);
	});

	it('should reject with error if url is relative path', function() {
		url = '/some/path';
		return expect(fetch(url)).to.eventually.be.rejectedWith(Error);
	});

	it('should reject with error if protocol is unsupported', function() {
		url = 'ftp://example.com/';
		return expect(fetch(url)).to.eventually.be.rejectedWith(Error);
	});

	it('should reject with error on network failure', function() {
		url = 'http://localhost:50000/';
		return expect(fetch(url)).to.eventually.be.rejectedWith(Error);
	});

	it('should resolve into response', function() {
		url = base + '/hello';
		return fetch(url).then(function(res) {
			expect(res).to.be.an.instanceof(Response);
			expect(res.headers).to.be.an.instanceof(Headers);
			expect(res.body).to.be.an.instanceof(stream.Transform);
			expect(res.bodyUsed).to.be.false;

			expect(res.url).to.equal(url);
			expect(res.status).to.equal(200);
			expect(res.statusText).to.equal('OK');
		});
	});

	it('should accept plain text response', function() {
		url = base + '/plain';
		return fetch(url).then(function(res) {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(function(result) {
				expect(res.bodyUsed).to.be.true;
				expect(result).to.be.a('string');
				expect(result).to.equal('text');
			});
		});
	});

	it('should accept html response (like plain text)', function() {
		url = base + '/html';
		return fetch(url).then(function(res) {
			expect(res.headers.get('content-type')).to.equal('text/html');
			return res.text().then(function(result) {
				expect(res.bodyUsed).to.be.true;
				expect(result).to.be.a('string');
				expect(result).to.equal('<html></html>');
			});
		});
	});

	it('should accept json response', function() {
		url = base + '/json';
		return fetch(url).then(function(res) {
			expect(res.headers.get('content-type')).to.equal('application/json');
			return res.json().then(function(result) {
				expect(res.bodyUsed).to.be.true;
				expect(result).to.be.an('object');
				expect(result).to.deep.equal({ name: 'value' });
			});
		});
	});

	it('should send request with custom headers', function() {
		url = base + '/inspect';
		opts = {
			headers: { 'x-custom-header': 'abc' }
		};
		return fetch(url, opts).then(function(res) {
			return res.json();
		}).then(function(res) {
			expect(res.headers['x-custom-header']).to.equal('abc');
		});
	});

	it('should follow redirect code 301', function() {
		url = base + '/redirect/301';
		return fetch(url).then(function(res) {
			expect(res.url).to.equal(base + '/inspect');
			expect(res.status).to.equal(200);
		});
	});


	it('should follow redirect code 302', function() {
		url = base + '/redirect/302';
		return fetch(url).then(function(res) {
			expect(res.url).to.equal(base + '/inspect');
			expect(res.status).to.equal(200);
		});
	});

	it('should follow redirect code 303', function() {
		url = base + '/redirect/303';
		return fetch(url).then(function(res) {
			expect(res.url).to.equal(base + '/inspect');
			expect(res.status).to.equal(200);
		});
	});

	it('should follow redirect code 307', function() {
		url = base + '/redirect/307';
		return fetch(url).then(function(res) {
			expect(res.url).to.equal(base + '/inspect');
			expect(res.status).to.equal(200);
		});
	});

	it('should follow redirect code 308', function() {
		url = base + '/redirect/308';
		return fetch(url).then(function(res) {
			expect(res.url).to.equal(base + '/inspect');
			expect(res.status).to.equal(200);
		});
	});

	it('should follow redirect chain', function() {
		url = base + '/redirect/chain';
		return fetch(url).then(function(res) {
			expect(res.url).to.equal(base + '/inspect');
			expect(res.status).to.equal(200);
		});
	});

	it('should obey maximum redirect limit', function() {
		url = base + '/redirect/chain';
		opts = {
			follow: 1
		};
		return expect(fetch(url, opts)).to.eventually.be.rejectedWith(Error);
	});

	it('should decompress gzip response', function() {
		url = base + '/gzip';
		return fetch(url).then(function(res) {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(function(result) {
				expect(result).to.be.a('string');
				expect(result).to.equal('hello world');
			});
		});
	});

	it('should decompress deflate response', function() {
		url = base + '/deflate';
		return fetch(url).then(function(res) {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(function(result) {
				expect(result).to.be.a('string');
				expect(result).to.equal('hello world');
			});
		});
	});

	it('should allow disabling auto decompression', function() {
		url = base + '/gzip';
		opts = {
			compress: false
		};
		return fetch(url, opts).then(function(res) {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(function(result) {
				expect(result).to.be.a('string');
				expect(result).to.not.equal('hello world');
			});
		});
	});

	it('should allow custom timeout', function() {
		url = base + '/timeout';
		opts = {
			timeout: 100
		};
		return expect(fetch(url, opts)).to.eventually.be.rejectedWith(Error);
	});

	it('should allow POST request', function() {
		url = base + '/inspect';
		opts = {
			method: 'POST'
		};
		return fetch(url, opts).then(function(res) {
			return res.json();
		}).then(function(res) {
			expect(res.method).to.equal('POST');
		});
	});

	it('should allow POST request with string body', function() {
		url = base + '/inspect';
		opts = {
			method: 'POST'
			, body: 'a=1'
		};
		return fetch(url, opts).then(function(res) {
			return res.json();
		}).then(function(res) {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('a=1');
		});
	});

	it('should allow POST request with readable stream as body', function() {
		url = base + '/inspect';
		opts = {
			method: 'POST'
			, body: resumer().queue('a=1').end()
		};
		return fetch(url, opts).then(function(res) {
			return res.json();
		}).then(function(res) {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('a=1');
		});
	});

});
