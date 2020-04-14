// Prior contributors: Torsten Werner <https://github.com/torstenwerner>
//                     Niklas Lindgren <https://github.com/nikcorg>
//                     Vinay Bedre <https://github.com/vinaybedre>
//                     Antonio Román <https://github.com/kyranet>
//                     Andrew Leedham <https://github.com/AndrewLeedham>
//                     Jason Li <https://github.com/JasonLi914>
//                     Brandon Wilson <https://github.com/wilsonianb>
//                     Steve Faulkner <https://github.com/southpolesteve>

/// <reference types="node" />

import {URL, URLSearchParams} from 'url';
import {Agent} from 'http';

export class Request extends Body {
	method: string;
	redirect: RequestRedirect;
	referrer: string;
	url: string;

	// Node-fetch extensions to the whatwg/fetch spec
	agent?: Agent | ((parsedUrl: URL) => Agent);
	compress: boolean;
	counter: number;
	follow: number;
	hostname: string;
	port?: number;
	protocol: string;
	size: number;
	timeout: number;
	highWaterMark?: number;

	context: RequestContext;
	headers: Headers;
	constructor(input: string | { href: string } | Request, init?: RequestInit);
	static redirect(url: string, status?: number): Response;
	clone(): Request;
}

export interface RequestInit {
	// Whatwg/fetch standard options
	body?: BodyInit;
	headers?: HeadersInit;
	method?: string;
	redirect?: RequestRedirect;
	signal?: AbortSignal | null;

	// Node-fetch extensions
	agent?: Agent | ((parsedUrl: URL) => Agent); // =null http.Agent instance, allows custom proxy, certificate etc.
	compress?: boolean; // =true support gzip/deflate content encoding. false to disable
	follow?: number; // =20 maximum redirect count. 0 to not follow redirect
	size?: number; // =0 maximum response body size in bytes. 0 to disable
	timeout?: number; // =0 req/res timeout in ms, it resets on redirect. 0 to disable (OS limit applies)
	highWaterMark?: number; // =16384 the maximum number of bytes to store in the internal buffer before ceasing to read from the underlying resource.

	// node-fetch does not support mode, cache or credentials options
}

export type RequestContext =
	'audio'
	| 'beacon'
	| 'cspreport'
	| 'download'
	| 'embed'
	| 'eventsource'
	| 'favicon'
	| 'fetch'
	| 'font'
	| 'form'
	| 'frame'
	| 'hyperlink'
	| 'iframe'
	| 'image'
	| 'imageset'
	| 'import'
	| 'internal'
	| 'location'
	| 'manifest'
	| 'object'
	| 'ping'
	| 'plugin'
	| 'prefetch'
	| 'script'
	| 'serviceworker'
	| 'sharedworker'
	| 'style'
	| 'subresource'
	| 'track'
	| 'video'
	| 'worker'
	| 'xmlhttprequest'
	| 'xslt';
export type RequestMode = 'cors' | 'no-cors' | 'same-origin';
export type RequestRedirect = 'error' | 'follow' | 'manual';
export type RequestCredentials = 'omit' | 'include' | 'same-origin';

export type RequestCache =
	'default'
	| 'force-cache'
	| 'no-cache'
	| 'no-store'
	| 'only-if-cached'
	| 'reload';

export class Headers implements Iterable<[string, string]> {
	constructor(init?: HeadersInit);
	forEach(callback: (value: string, name: string) => void): void;
	append(name: string, value: string): void;
	delete(name: string): void;
	get(name: string): string | null;
	getAll(name: string): string[];
	has(name: string): boolean;
	raw(): { [k: string]: string[] };
	set(name: string, value: string): void;

	// Iterator methods
	entries(): Iterator<[string, string]>;
	keys(): Iterator<string>;
	values(): Iterator<[string]>;
	[Symbol.iterator](): Iterator<[string, string]>;
}

type BlobPart = ArrayBuffer | ArrayBufferView | Blob | string;

interface BlobOptions {
	type?: string;
	endings?: 'transparent' | 'native';
}

export class Blob {
	readonly type: string;
	readonly size: number;
	constructor(blobParts?: BlobPart[], options?: BlobOptions);
	slice(start?: number, end?: number): Blob;
}

export class Body {
	body: NodeJS.ReadableStream;
	bodyUsed: boolean;
	size: number;
	timeout: number;
	constructor(body?: any, opts?: { size?: number; timeout?: number });
	arrayBuffer(): Promise<ArrayBuffer>;
	blob(): Promise<Blob>;
	buffer(): Promise<Buffer>;
	json(): Promise<any>;
	text(): Promise<string>;
}

export class FetchError extends Error {
	name: 'FetchError';
	[Symbol.toStringTag]: 'FetchError';
	type: string;
	code?: string;
	errno?: string;
	constructor(message: string, type: string, systemError?: object);
}

export class AbortError extends Error {
	type: string;
	message: string;
	name: 'AbortError';
	[Symbol.toStringTag]: 'AbortError';
	constructor(message: string);
}

export class Response extends Body {
	headers: Headers;
	ok: boolean;
	redirected: boolean;
	status: number;
	statusText: string;
	type: ResponseType;
	url: string;
	size: number;
	timeout: number;
	constructor(body?: BodyInit, init?: ResponseInit);
	static error(): Response;
	static redirect(url: string, status: number): Response;
	clone(): Response;
}

export type ResponseType =
	'basic'
	| 'cors'
	| 'default'
	| 'error'
	| 'opaque'
	| 'opaqueredirect';

export interface ResponseInit {
	headers?: HeadersInit;
	size?: number;
	status?: number;
	statusText?: string;
	timeout?: number;
	url?: string;
}

export type HeadersInit = Headers | string[][] | { [key: string]: string };
// HeaderInit is exported to support backwards compatibility. See PR #34382
export type HeaderInit = HeadersInit;
export type BodyInit =
	ArrayBuffer
	| ArrayBufferView
	| NodeJS.ReadableStream
	| string
	| URLSearchParams;
export type RequestInfo = string | Request;

declare function fetch(
	url: RequestInfo,
	init?: RequestInit
): Promise<Response>;

declare namespace fetch {
	function isRedirect(code: number): boolean;
}

export default fetch;
