/**
 * Browser entry point.
 *
 * This file is referenced by the top-level "browser" field in package.json
 * and by the "browser" condition of the "exports" map, so that bundlers
 * targeting browsers use the global fetch implementation instead of pulling
 * in the Node.js-specific code from src/index.js (node:http, node:zlib, ...).
 */

let globalObject = globalThis;
if (typeof self === 'object' && self !== null) {
	globalObject = self;
} else if (typeof window === 'object' && window !== null) {
	globalObject = window;
}

const {fetch: globalFetch, Headers, Request, Response, FormData, Blob, File} = globalObject;

if (typeof globalFetch === 'function') {
	// Global fetch implementation found - export it below
} else {
	throw new TypeError('node-fetch: no global fetch() implementation found. Use Node.js or install a fetch polyfill.');
}

export default globalFetch.bind(globalObject);

export {Headers, Request, Response, FormData, Blob, File};

const redirectStatus = new Set([301, 302, 303, 307, 308]);

/**
 * Redirect code matching
 *
 * @param {number} code - Status code
 * @return {boolean}
 */
export const isRedirect = code => {
	return redirectStatus.has(code);
};

/**
 * FetchError - thrown when a fetch fails for network/system reasons
 */
export class FetchError extends Error {
	constructor(message, type, systemError) {
		super(message);
		this.name = 'FetchError';
		this.type = type;
		if (systemError) {
			this.code = systemError.code;
			this.errno = systemError.errno;
		}
	}

	get [Symbol.toStringTag]() {
		return 'FetchError';
	}
}

/**
 * AbortError - thrown when a fetch is aborted via AbortSignal
 */
export class AbortError extends Error {
	constructor(message) {
		super(message);
		this.name = 'AbortError';
		this.type = 'aborted';
	}

	get [Symbol.toStringTag]() {
		return 'AbortError';
	}
}
