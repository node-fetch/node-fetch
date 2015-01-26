
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

var url, opts;

describe('Fetch', function() {

	before(function() {
		// TODO: local server for more stable testing
	});

	it('should return a promise', function() {
		url = 'http://example.com/';
		expect(fetch(url)).to.be.an.instanceof(fetch.Promise);
	});

	it('should return custom promise', function() {
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
		url = 'http://example.com/';
		return fetch(url).then(function(res) {
			console.log(res);
		});
	});
});
