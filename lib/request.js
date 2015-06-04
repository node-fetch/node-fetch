
/**
 * request.js
 *
 * Request class contains server only options
 */

var parse_url = require('url').parse;

module.exports = Request;

/**
 * Request class
 *
 * @param   Mixed   input  Url or Request instance
 * @param   Object  init   Custom options
 * @return  Void
 */
function Request(input, init) {
	var url, url_parsed;

	// normalize input
	if (!(input instanceof Request)) {
		url = input;
		url_parsed = parse_url(url);
		input = {};
	} else {
		url = input.url;
		url_parsed = parse_url(url);
	}

	if (!url_parsed.protocol || !url_parsed.hostname) {
		throw new Error('only absolute urls are supported');
	}

	if (url_parsed.protocol !== 'http:' && url_parsed.protocol !== 'https:') {
		throw new Error('only http(s) protocols are supported');
	}

	// normalize init
	init = init || {};

	// fetch spec options
	this.method = init.method || input.method || 'GET';
	this.headers = init.headers || input.headers || {};
	this.body = init.body || input.body;
	this.url = url;

	// server only
	this.protocol = url_parsed.protocol;
	this.hostname = url_parsed.hostname;
	this.port = url_parsed.port;
	this.path = url_parsed.path;
	this.auth = url_parsed.auth;

	this.follow = init.follow !== undefined ? init.follow : 20;
	this.counter = init.counter || 0;
	this.timeout = init.timeout || 0;
	this.compress = init.compress !== false;
	this.size = init.size || 0;
	this.agent = init.agent;
}
