
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
			expect(res.ok).to.be.true;
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
			expect(res.ok).to.be.true;
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

	it('should obey maximum redirect', function() {
		url = base + '/redirect/chain';
		opts = {
			follow: 1
		}
		return expect(fetch(url, opts)).to.eventually.be.rejectedWith(Error);
	});

	it('should allow not following redirect', function() {
		url = base + '/redirect/301';
		opts = {
			follow: 0
		}
		return expect(fetch(url, opts)).to.eventually.be.rejectedWith(Error);
	});

	it('should reject broken redirect', function() {
		url = base + '/error/redirect';
		return expect(fetch(url)).to.eventually.be.rejectedWith(Error);
	});

	it('should handle client-error response', function() {
		url = base + '/error/400';
		return fetch(url).then(function(res) {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			expect(res.status).to.equal(400);
			expect(res.statusText).to.equal('Bad Request');
			expect(res.ok).to.be.false;
			return res.text().then(function(result) {
				expect(res.bodyUsed).to.be.true;
				expect(result).to.be.a('string');
				expect(result).to.equal('client error');
			});
		});
	});

	it('should handle server-error response', function() {
		url = base + '/error/500';
		return fetch(url).then(function(res) {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			expect(res.status).to.equal(500);
			expect(res.statusText).to.equal('Internal Server Error');
			expect(res.ok).to.be.false;
			return res.text().then(function(result) {
				expect(res.bodyUsed).to.be.true;
				expect(result).to.be.a('string');
				expect(result).to.equal('server error');
			});
		});
	});

	it('should handle network-error response', function() {
		url = base + '/error/reset';
		return expect(fetch(url)).to.eventually.be.rejectedWith(Error);
	});

	it('should reject invalid json response', function() {
		url = base + '/error/json';
		return fetch(url).then(function(res) {
			expect(res.headers.get('content-type')).to.equal('application/json');
			return expect(res.json()).to.eventually.be.rejectedWith(Error);
		});
	});

	it('should handle empty response', function() {
		url = base + '/empty';
		return fetch(url).then(function(res) {
			expect(res.status).to.equal(204);
			expect(res.statusText).to.equal('No Content');
			expect(res.ok).to.be.true;
			return res.text().then(function(result) {
				expect(result).to.be.a('string');
				expect(result).to.be.empty;
			});
		});
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

	it('should skip decompression if unsupported', function() {
		url = base + '/sdch';
		return fetch(url).then(function(res) {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(function(result) {
				expect(result).to.be.a('string');
				expect(result).to.equal('fake sdch string');
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

	it('should allow PUT request', function() {
		url = base + '/inspect';
		opts = {
			method: 'PUT'
			, body: 'a=1'
		};
		return fetch(url, opts).then(function(res) {
			return res.json();
		}).then(function(res) {
			expect(res.method).to.equal('PUT');
			expect(res.body).to.equal('a=1');
		});
	});

	it('should allow DELETE request', function() {
		url = base + '/inspect';
		opts = {
			method: 'DELETE'
		};
		return fetch(url, opts).then(function(res) {
			return res.json();
		}).then(function(res) {
			expect(res.method).to.equal('DELETE');
		});
	});

	it('should allow PATCH request', function() {
		url = base + '/inspect';
		opts = {
			method: 'PATCH'
			, body: 'a=1'
		};
		return fetch(url, opts).then(function(res) {
			return res.json();
		}).then(function(res) {
			expect(res.method).to.equal('PATCH');
			expect(res.body).to.equal('a=1');
		});
	});

	it('should allow HEAD request', function() {
		url = base + '/hello';
		opts = {
			method: 'HEAD'

		};
		return fetch(url, opts).then(function(res) {
			expect(res.status).to.equal(200);
			expect(res.statusText).to.equal('OK');
			expect(res.headers.get('content-type')).to.equal('text/plain');
			expect(res.body).to.be.an.instanceof(stream.Transform);
		});
	});

	it('should reject decoding body twice', function() {
		url = base + '/plain';
		return fetch(url).then(function(res) {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(function(result) {
				expect(res.bodyUsed).to.be.true;
				return expect(res.text()).to.eventually.be.rejectedWith(Error);
			});
		});
	});

	it('should support maximum response size, multiple chunk', function() {
		url = base + '/size/chunk';
		opts = {
			size: 5
		};
		return fetch(url, opts).then(function(res) {
			expect(res.status).to.equal(200);
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return expect(res.text()).to.eventually.be.rejectedWith(Error);
		});
	});

	it('should support maximum response size, single chunk', function() {
		url = base + '/size/long';
		opts = {
			size: 5
		};
		return fetch(url, opts).then(function(res) {
			expect(res.status).to.equal(200);
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return expect(res.text()).to.eventually.be.rejectedWith(Error);
		});
	});

	it('should support encoding decode, xml dtd detect', function() {
		url = base + '/encoding/euc-jp';
		return fetch(url).then(function(res) {
			expect(res.status).to.equal(200);
			return res.text().then(function(result) {
				expect(result).to.equal('<?xml version="1.0" encoding="EUC-JP"?><title>日本語</title>');
			});
		});
	});

	it('should support encoding decode, content-type detect', function() {
		url = base + '/encoding/shift-jis';
		return fetch(url).then(function(res) {
			expect(res.status).to.equal(200);
			return res.text().then(function(result) {
				expect(result).to.equal('<div>日本語</div>');
			});
		});
	});

	it('should support encoding decode, html5 detect', function() {
		url = base + '/encoding/gbk';
		return fetch(url).then(function(res) {
			expect(res.status).to.equal(200);
			return res.text().then(function(result) {
				expect(result).to.equal('<meta charset="gbk"><div>中文</div>');
			});
		});
	});

	it('should support encoding decode, html4 detect', function() {
		url = base + '/encoding/gb2312';
		return fetch(url).then(function(res) {
			expect(res.status).to.equal(200);
			return res.text().then(function(result) {
				expect(result).to.equal('<meta http-equiv="Content-Type" content="text/html; charset=gb2312"><div>中文</div>');
			});
		});
	});

	it('should default to utf8 encoding', function() {
		url = base + '/encoding/utf8';
		return fetch(url).then(function(res) {
			expect(res.status).to.equal(200);
			expect(res.headers.get('content-type')).to.be.null;
			return res.text().then(function(result) {
				expect(result).to.equal('中文');
			});
		});
	});

	it('should support uncommon content-type order, charset in front', function() {
		url = base + '/encoding/order1';
		return fetch(url).then(function(res) {
			expect(res.status).to.equal(200);
			return res.text().then(function(result) {
				expect(result).to.equal('中文');
			});
		});
	});

	it('should support uncommon content-type order, end with qs', function() {
		url = base + '/encoding/order2';
		return fetch(url).then(function(res) {
			expect(res.status).to.equal(200);
			return res.text().then(function(result) {
				expect(result).to.equal('中文');
			});
		});
	});

	it('should allow piping response body as stream', function(done) {
		url = base + '/hello';
		fetch(url).then(function(res) {
			expect(res.body).to.be.an.instanceof(stream.Transform);
			res.body.on('data', function(chunk) {
				if (chunk === null) {
					return;
				}
				expect(chunk.toString()).to.equal('world');
			});
			res.body.on('end', function() {
				done();
			});
		});
	});

	it('should allow get all responses of a header', function() {
		url = base + '/cookie';
		return fetch(url).then(function(res) {
			expect(res.headers.get('set-cookie')).to.equal('a=1');
			expect(res.headers.get('Set-Cookie')).to.equal('a=1');
			expect(res.headers.getAll('set-cookie')).to.deep.equal(['a=1', 'b=1']);
			expect(res.headers.getAll('Set-Cookie')).to.deep.equal(['a=1', 'b=1']);
		});
	});

	it('should allow deleting header', function() {
		url = base + '/cookie';
		return fetch(url).then(function(res) {
			res.headers.delete('set-cookie');
			expect(res.headers.get('set-cookie')).to.be.null;
			expect(res.headers.getAll('set-cookie')).to.be.empty;
		});
	});

	it('should skip prototype when reading response headers', function() {
		var FakeHeader = function() {};
		FakeHeader.prototype.c = 'string';
		FakeHeader.prototype.d = [1,2,3,4];
		var res = new FakeHeader;
		res.a = 'string';
		res.b = [];
		var headers = new Headers(res);
		expect(headers._headers['a']).to.include('string');
		expect(headers._headers['b']).to.be.undefined;
		expect(headers._headers['c']).to.be.undefined;
		expect(headers._headers['d']).to.be.undefined;
	});

	it('should support https request', function() {
		this.timeout(5000);
		url = 'https://github.com/';
		opts = {
			method: 'HEAD'
		};
		return fetch(url, opts).then(function(res) {
			expect(res.status).to.equal(200);
			expect(res.ok).to.be.true;
		});
	});

});
