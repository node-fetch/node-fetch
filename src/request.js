
/**
 * request.js
 *
 * Request class contains server only options
 *
 * All spec algorithm step numbers are based on https://fetch.spec.whatwg.org/commit-snapshots/ae716822cb3a61843226cd090eefc6589446c1d2/.
 */

import Url from 'url';
import Stream from 'stream';
import Headers, { exportNodeCompatibleHeaders } from './headers.js';
import Body, { clone, extractContentType, getTotalBytes } from './body';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';


var pjson = require('../package.json');
import cacheManager from 'cache-manager';
import {remote, ipcRenderer} from 'electron';
import {Mutex} from 'async-mutex';
import ZitiAgent from './ziti-agent';
const session = remote.session.defaultSession;

const trackEvent = remote.getGlobal('trackEvent');

const debug = require('debug')('ziti');

const SIXTY = 60;
const TTL = SIXTY * SIXTY; // one hour

const memoryCache = cacheManager.caching({store: 'memory', max: SIXTY, ttl: TTL});

const mutex = new Mutex();

const INTERNALS = Symbol('Request internals');

// fix an issue where "format", "parse" aren't a named export for node <10
const parse_url = Url.parse;
const format_url = Url.format;

const streamDestructionSupported = 'destroy' in Stream.Readable.prototype;


/**
 * Get path to identity file
 *
 * @return  full path to identity file
 */
function getIdentityFilePath() {
	const identityFilePath = path.join( remote.app.getPath('userData'), 'ziti-identity.json' );
	log.debug('identityFilePath is: %s', identityFilePath);
	return identityFilePath;
}

/**
 * Perform Ziti enrollment (connect with Ziti Controller)
 *
 * @return  Promise
 */
async function NF_enroll() {
	return new Promise((resolve, reject) => {
		
		log.debug('NF_enroll entered');

		let identityPath = window.zitiIdentityPath;	// This is assumed to be set by the app that is hosting us (e.g. Mattermost's MattermostView.jsx)
		if (!identityPath || identityPath==='') {
			log.debug('identityPath unset (%o)', identityPath);

			ipcRenderer.sendToHost('did-fail-load', {zitiIdentityPath: window.zitiIdentityPath, errorDescription: 'Ziti init failed, zitiIdentityPath not set', errorCode: -601});
			reject(new Error('Ziti init failed, window.zitiIdentityPath not set'));
		}

		const erc = window.ziti.NF_enroll(

			identityPath,
			
			(data) => {

				log.debug('window.ziti.NF_enroll callback entered, data is (%o)', data);	
					
				if (!data.identity) {
					ipcRenderer.sendToHost('did-fail-load', {zitiIdentityPath: window.zitiIdentityPath, errorDescription: 'Ziti enroll failed rc [' + data.len + '], ' + data.err, errorCode: -602});
					reject(new Error('Ziti enroll failed rc [' + data.len + '], JWT is invalid'));

				} else {

					fs.writeFileSync( getIdentityFilePath(), data.identity );

					resolve();
				}
			}
		);

		log.debug('window.ziti.NF_enroll rc is (%o)', erc);

		if (erc < 0) {
			if (erc == -2) {
				ipcRenderer.sendToHost('did-fail-load', {zitiIdentityPath: window.zitiIdentityPath, errorDescription: 'Ziti enroll failed rc [' + erc + '], JWT cannot be found', errorCode: -603});
			} else {
				ipcRenderer.sendToHost('did-fail-load', {zitiIdentityPath: window.zitiIdentityPath, errorDescription: 'Ziti enroll failed rc [' + erc + '], JWT is invalid', errorCode: -604});
			}
			reject(new Error('Ziti enroll failed rc [' + erc + '], JWT is invalid'));
		}
	});
};

/**
 * Perform Ziti initialization (connect with Ziti Controller)
 *
 * @return  Promise
 */
async function NF_init() {
	return new Promise( async (resolve, reject) => {
		
		log.debug('NF_init entered');

		if (window.zitiInitialized) {
			resolve(); // quick exit, init already done
		}

		// If we do not have an identity file yet
		if (!fs.existsSync( getIdentityFilePath() )) {

			await NF_enroll().catch((e) => {

				// ipcRenderer.sendToHost('did-fail-load', {zitiIdentityPath: window.zitiIdentityPath, errorDescription: 'Ziti init failed rc [' + rc + '], identity is invalid', errorCode: -703});
				reject(new Error('Ziti init failed rc [' + err + ']'));
	
			});


		}

		// let identityPath = window.zitiIdentityPath;	// This is assumed to be set by the app that is hosting us (e.g. Mattermost's MattermostView.jsx)
		// if (!identityPath || identityPath==='') {
		// 	debug('identityPath unset (%o)', identityPath);

		// 	ipcRenderer.sendToHost('did-fail-load', {zitiIdentityPath: window.zitiIdentityPath, errorDescription: 'Ziti init failed, zitiIdentityPath not set', errorCode: -601});
		// 	reject(new Error('Ziti init failed, window.zitiIdentityPath not set'));
		// }

		const rc = window.ziti.NF_init(

			getIdentityFilePath(),
			
			(cbRC) => {

				log.debug('window.ziti.NF_init callback entered, cbRC is (%o)', cbRC);
		
				if (cbRC < 0) {
					ipcRenderer.sendToHost('did-fail-load', {zitiIdentityPath: window.zitiIdentityPath, errorDescription: 'Ziti init failed rc [' + cbRC + '], identity is invalid', errorCode: -702});
					reject(new Error('Ziti init failed rc [' + cbRC + '], identity is invalid'));

				} else {
					resolve();
				}
			}
		);

		log.debug('window.ziti.NF_init rc is (%o)', rc);

		if (rc < 0) {
			ipcRenderer.sendToHost('did-fail-load', {zitiIdentityPath: window.zitiIdentityPath, errorDescription: 'Ziti init failed rc [' + rc + '], identity is invalid', errorCode: -703});
			reject(new Error('Ziti init failed rc [' + rc + '], identity is invalid'));
		}
	});
};
  
/**
 * Perform a synchronous, mutex-protected, Ziti initialization. 
 * We only want to initialize once, so we protect the call to the 
 * Ziti Controller behind a mutex.
 *
 * @return  Boolean
 */
async function doZitiInitialization() {
	const release = await mutex.acquire();
	try {
		if (!window.zitiInitialized) {
			await NF_init().catch((e) => {
			});
			window.zitiInitialized = true;
		}
	} finally {
		release();
	}
}
  
/**
 * Do an asynchronous wait for Ziti initialization to complete.
 *
 * @return  Promise
 */
function isZitiInitialized() {
	return new Promise((resolve) => {
	  (function waitForZitiInitialized() {
		if (window.zitiInitialized) {
		  return resolve();
		}
		setTimeout(waitForZitiInitialized, 100);
	  })();
	});
}

/**
 * Ask Ziti Controller if the named service is active in the Ziti network.
 *
 * @param   String   service
 * @return  Promise
 */
function callNativeNFServiceAvailable(service) {
	return new Promise((resolve) => {
	  	window.ziti.NF_service_available(service, (status) => { // eslint-disable-line new-cap
			resolve(status);
	  	});
	});
}
  
/**
 * Determine if the named service is active in the Ziti network. We check our cache first, which is backed
 * by an asynchronous call to the Ziti Controller.
 *
 * @param   String   service
 * @return  Promise
 */
function getCachedServiceAvailable(service) {
	return new Promise((resolve, reject) => {
	  	memoryCache.get(service, async (err, cachedResult) => {
			if (err) {
		  		reject(err); 
			}
			if (cachedResult) {
		  		resolve(cachedResult);
			} else {

		  		const newResult = await callNativeNFServiceAvailable(service).catch((e) => console.log('callNativeNFServiceAvailable Error: ', e.message)); // eslint-disable-line new-cap
				  
				  memoryCache.set(service, newResult);
		  		resolve(newResult);
			}
	  	});
	});
}
  
  
/**
 * Check if a value is an instance of Request.
 *
 * @param   Mixed   input
 * @return  Boolean
 */
function isRequest(input) {
	return (
		typeof input === 'object' &&
		typeof input[INTERNALS] === 'object'
	);
}

function isAbortSignal(signal) {
	const proto = (
		signal
		&& typeof signal === 'object'
		&& Object.getPrototypeOf(signal)
	);
	return !!(proto && proto.constructor.name === 'AbortSignal');
}

/**
 * Request class
 *
 * @param   Mixed   input  Url or Request instance
 * @param   Object  init   Custom options
 * @return  Void
 */
export default class Request {
	constructor(input, init = {}, sessionCookies) {
		let parsedURL;

		// normalize input
		if (!isRequest(input)) {
			if (input && input.href) {
				// in order to support Node.js' Url objects; though WHATWG's URL objects
				// will fall into this branch also (since their `toString()` will return
				// `href` property anyway)
				parsedURL = parse_url(input.href);
			} else {
				// coerce input to a string before attempting to parse
				parsedURL = parse_url(`${input}`);
			}
			input = {};
		} else {
			parsedURL = parse_url(input.url);
		}

		let method = init.method || input.method || 'GET';
		method = method.toUpperCase();

		if ((init.body != null || isRequest(input) && input.body !== null) &&
			(method === 'GET' || method === 'HEAD')) {
			throw new TypeError('Request with GET/HEAD method cannot have body');
		}

		let inputBody = init.body != null ?
			init.body :
			isRequest(input) && input.body !== null ?
				clone(input) :
				null;

		Body.call(this, inputBody, {
			timeout: init.timeout || input.timeout || 0,
			size: init.size || input.size || 0
		});

		const headers = new Headers(init.headers || input.headers || {});

		if (inputBody != null && !headers.has('Content-Type')) {
			const contentType = extractContentType(inputBody);
			if (contentType) {
				headers.append('Content-Type', contentType);
			}
		}

		let signal = isRequest(input)
			? input.signal
			: null;
		if ('signal' in init) signal = init.signal

		if (signal != null && !isAbortSignal(signal)) {
			throw new TypeError('Expected signal to be an instanceof AbortSignal');
		}

		this[INTERNALS] = {
			method,
			redirect: init.redirect || input.redirect || 'follow',
			headers,
			parsedURL,
			signal,
		};

		// node-fetch-only options
		this.follow = init.follow !== undefined ?
			init.follow : input.follow !== undefined ?
			input.follow : 20;
		this.compress = init.compress !== undefined ?
			init.compress : input.compress !== undefined ?
			input.compress : true;
		this.counter = init.counter || input.counter || 0;
		this.agent = init.agent || input.agent;
		this.sessionCookies = sessionCookies;
	}

	get method() {
		return this[INTERNALS].method;
	}

	get url() {
		return format_url(this[INTERNALS].parsedURL);
	}

	get headers() {
		return this[INTERNALS].headers;
	}

	get redirect() {
		return this[INTERNALS].redirect;
	}

	get signal() {
		return this[INTERNALS].signal;
	}

	/**
	 * Clone this request
	 *
	 * @return  Request
	 */
	clone() {
		return new Request(this);
	}
}

Body.mixIn(Request.prototype);

Object.defineProperty(Request.prototype, Symbol.toStringTag, {
	value: 'Request',
	writable: false,
	enumerable: false,
	configurable: true
});

Object.defineProperties(Request.prototype, {
	method: { enumerable: true },
	url: { enumerable: true },
	headers: { enumerable: true },
	redirect: { enumerable: true },
	clone: { enumerable: true },
	signal: { enumerable: true },
});

/**
 * Load all cookies from Electron persistent storage into memory.
 *
 * @param   Request  A Request instance
 * @param   Domain   A cookie domain
 * @return  Promise
 */
const loadCookies = (request, domain) => {
	return new Promise((resolve, reject) => {
	  	session.cookies.get({domain}).then((cookies) => {
			cookies.forEach((cookie) => {
				request.sessionCookies.put(cookie);
			});
			resolve();
	  	}).catch((error) => {
			reject(error);
	  	});
	});
};
  
/**
 * Convert a Request to Node.js http request options.
 *
 * @param   Request  A Request instance
 * @return  Object   The options object to be passed to http.request
 */
export async function getNodeRequestOptions(request) {
	const parsedURL = request[INTERNALS].parsedURL;
	const headers = new Headers(request[INTERNALS].headers);

	if (request.sessionCookies.isEmpty()) {
		await loadCookies(request, parsedURL.hostname);
	}

	for (const key in request.sessionCookies.getAll()) {
		// skip loop if the property is from prototype
		if (!request.sessionCookies.hasOwnProperty(key)) continue;

		const cookie = request.sessionCookies.get(key);

		if (!cookie) continue;
		if (!cookie.domain) continue;

		if ((cookie.domain === parsedURL.hostname) || (cookie.domain === ('.' + parsedURL.hostname))) {
			headers.append('Cookie', cookie.name + '=' + cookie.value);
			if (cookie.name === 'MMAUTHTOKEN') {
				headers.append('Authorization', 'Bearer ' + cookie.value);
			}
		}
	}
	
	// fetch step 1.3
	if (!headers.has('Accept')) {
		headers.set('Accept', 'text/*');	// limit to text for now
	}

	// Basic fetch
	if (!parsedURL.protocol || !parsedURL.hostname) {
		throw new TypeError('Only absolute URLs are supported');
	}

	if (!/^https?:$/.test(parsedURL.protocol)) {
		throw new TypeError('Only HTTP(S) protocols are supported');
	}

	if (
		request.signal
		&& request.body instanceof Stream.Readable
		&& !streamDestructionSupported
	) {
		throw new Error('Cancellation of streamed requests with AbortSignal is not supported in node < 8');
	}

	// HTTP-network-or-cache fetch steps 2.4-2.7
	let contentLengthValue = null;
	if (request.body == null && /^(POST|PUT)$/i.test(request.method)) {
		contentLengthValue = '0';
	}
	if (request.body != null) {
		const totalBytes = getTotalBytes(request);
		if (typeof totalBytes === 'number') {
			contentLengthValue = String(totalBytes);
		}
	}
	if (contentLengthValue) {
		headers.set('Content-Length', contentLengthValue);
	}

	// HTTP-network-or-cache fetch step 2.11
	if (!headers.has('User-Agent')) {
		headers.set('User-Agent', 'ziti-electron-fetch/' + pjson.version + ' (+https://github.com/netfoundry/node-fetch)');
	}

	// --- Disable gzip for now ---
	//
	// // HTTP-network-or-cache fetch step 2.15
	// if (request.compress && !headers.has('Accept-Encoding')) {
	// 	headers.set('Accept-Encoding', 'gzip,deflate');
	// }

	let agent = request.agent;
	if (typeof agent === 'function') {
		agent = agent(parsedURL);
	}

	doZitiInitialization();

	await isZitiInitialized().catch((e) => console.log('isZitiInitialized(), Error: ', e.message));

	const serviceIsAvailable = await getCachedServiceAvailable(parsedURL.host).catch((e) => console.log('getCachedServiceAvailable Error: ', e.message)); // eslint-disable-line new-cap

    if (serviceIsAvailable) {
	  	if (serviceIsAvailable.status === 0) {
        	agent = new ZitiAgent(parsedURL);
      	}
	}
	
	if (!headers.has('Connection') && !agent) {
		headers.set('Connection', 'close');
	}

	// HTTP-network fetch step 4.2
	// chunked encoding is handled by Node.js

	return Object.assign({}, parsedURL, {
		method: request.method,
		headers: exportNodeCompatibleHeaders(headers),
		agent
	});
}
