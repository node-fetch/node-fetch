/// <reference lib="dom" />
/// <reference types="node" />

import { Agent } from 'http';

interface NodeFetchHeaders extends Headers {
	raw(): Record<string, string>;

	// Iterator methods, somehow missing from lib Headers
	entries(): Iterator<[string, string]>;
	keys(): Iterator<string>;
	values(): Iterator<[string]>;
	[Symbol.iterator](): Iterator<[string, string]>;
}
declare var NodeFetchHeaders: {
	prototype: NodeFetchHeaders;
	new(init?: HeadersInit): NodeFetchHeaders;
};

declare interface NodeFetchRequestInit extends Omit<RequestInit, 'window' | 'integrity' | 'credentials' | 'mode' | 'cache' | 'referrer' | 'referrerPolicy'> {
	// Node-fetch extensions to the whatwg/fetch spec
	agent?: Agent | ((parsedUrl: URL) => Agent);
	compress?: boolean;
	counter?: number;
	follow?: number;
	hostname?: string;
	port?: number;
	protocol?: string;
	size?: number;
	timeout?: number;
	highWaterMark?: number;
}

type NodeFetchBodyInit = Blob | Buffer | URLSearchParams | NodeJS.ReadableStream | string;
interface NodeFetchBody {
	readonly body: NodeJS.ReadableStream | null;
	readonly bodyUsed: boolean;
	readonly size: number;
	readonly timeout: number;
	buffer(): Promise<Buffer>;
	arrayBuffer(): Promise<ArrayBuffer>;
	blob(): Promise<Blob>;
	json(): Promise<unknown>;
	text(): Promise<string>;
}
declare var NodeFetchBody: {
	prototype: NodeFetchBody;
	new(body?: NodeFetchBodyInit, opts?: { size?: number; timeout?: number }): NodeFetchBody;
};

interface NodeFetchRequest extends NodeFetchBody {
    /**
     * Returns a Headers object consisting of the headers associated with request. Note that headers added in the network layer by the user agent will not be accounted for in this object, e.g., the "Host" header.
     */
	readonly headers: NodeFetchHeaders;
    /**
     * Returns request's HTTP method, which is "GET" by default.
     */
	readonly method: string;
    /**
     * Returns the redirect mode associated with request, which is a string indicating how redirects for the request will be handled during fetching. A request will follow redirects by default.
     */
	readonly redirect: RequestRedirect;
    /**
     * Returns the signal associated with request, which is an AbortSignal object indicating whether or not request has been aborted, and its abort event handler.
     */
	readonly signal: AbortSignal;
    /**
     * Returns the URL of request as a string.
     */
	readonly url: string;
	clone(): NodeFetchRequest;
}
type NodeFetchRequestInfo = string | NodeFetchBody;
declare var NodeFetchRequest: {
	prototype: NodeFetchRequest;
	new(input: NodeFetchRequestInfo, init?: NodeFetchRequestInit): NodeFetchRequest;
};

interface NodeFetchResponse extends NodeFetchBody {
	readonly headers: NodeFetchHeaders;
	readonly ok: boolean;
	readonly redirected: boolean;
	readonly status: number;
	readonly statusText: string;
	readonly url: string;
	clone(): NodeFetchResponse;
}

declare var NodeFetchResponse: {
	prototype: NodeFetchResponse;
	new(body?: BodyInit | null, init?: ResponseInit): NodeFetchResponse;
};

declare function fetch(
	url: NodeFetchRequestInfo,
	init?: NodeFetchRequestInit
): Promise<NodeFetchResponse>;

declare namespace fetch {
	function isRedirect(code: number): boolean;
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
	name: 'AbortError';
	[Symbol.toStringTag]: 'AbortError';
}

export { NodeFetchRequest as Request }
export { NodeFetchHeaders as Headers }
export { NodeFetchResponse as Response }
export default fetch;
