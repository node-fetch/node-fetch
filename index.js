
/**
 * index.js
 *
 * export fetch
 */

var parser = require('url');
var http = require('http');
var https = require('https');
var zlib = require('zlib');

module.exports = Fetch;

/**
 * Create an instance of Decent
 *
 * @param   String   url   Absolute url
 * @param   Object   opts  Fetch options
 * @return  Promise
 */
function Fetch(url, opts) {

	if (!(this instanceof Fetch))
		return new Fetch(url, opts);



};

Fetch.Promise = global.Promise;
