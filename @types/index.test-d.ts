import {expectType} from 'tsd';
import fetch, {Request, Response, Headers, FetchError, AbortError} from '.';

async function run() {
	const getRes = await fetch('https://bigfile.com/test.zip');
	expectType<boolean>(getRes.ok);
	expectType<number>(getRes.size);
	expectType<number>(getRes.status);
	expectType<string>(getRes.statusText);
	expectType<() => Response>(getRes.clone);

	// Test async iterator over body
	expectType<NodeJS.ReadableStream | null>(getRes.body);
	if (getRes.body) {
		for await (const data of getRes.body) {
			expectType<Buffer | string>(data);
		}
	}

	// Test Buffer
	expectType<Buffer>(await getRes.buffer());

	// Test arrayBuffer
	expectType<ArrayBuffer>(await getRes.arrayBuffer());

	// Test JSON, returns unknown
	expectType<unknown>(await getRes.json());

	// Headers iterable
	expectType<Headers>(getRes.headers);

	// Post
	try {
		const request = new Request('http://byjka.com/buka');
		expectType<string>(request.url);
		expectType<Headers>(request.headers);

		const headers = new Headers({byaka: 'buke'});
		expectType<(a: string, b: string) => void>(headers.append);
		expectType<(a: string) => string | null>(headers.get);
		expectType<(name: string, value: string) => void>(headers.set);
		expectType<(name: string) => void>(headers.delete);
		expectType<() => IterableIterator<string>>(headers.keys);
		expectType<() => IterableIterator<[string, string]>>(headers.entries);
		expectType<() => IterableIterator<[string, string]>>(headers[Symbol.iterator]);

		const postRes = await fetch(request, {method: 'POST', headers});
		expectType<Blob>(await postRes.blob());
	} catch (error) {
		if (error instanceof FetchError) {
			throw new TypeError(error.errno);
		}

		if (error instanceof AbortError) {
			throw error;
		}
	}

	const response = new Response();
	expectType<string>(response.url);
}

run().finally(() => {
	console.log('✅');
});
