import fetch, { Request, Headers, FetchError, AbortError } from '../../';

async function run() {
	const getRes = await fetch('https://bigfile.com/test.zip');
	// ok must be boolean, so do strict equality
	if (getRes.ok !== true) throw new Error(`Unable to download with error code ${0 + getRes.status}: ${'' + getRes.statusText}`)
	console.log('File size: %d Kb', getRes.size / 1024);
	// test async iterator over body
	const chunks: (Buffer | string)[] = [];
	if (getRes.body)
		for await (const data of getRes.body) {
			chunks.push(data);
		}

	// test Buffer
	const buf = await getRes.buffer();
	console.log(buf.readBigInt64BE(0))

	// test arrayBuffer
	const ab = await getRes.arrayBuffer();
	console.log(ab.byteLength);

	// test JSON, returns unknown
	const json: string[] = await getRes.json() as string[];
	console.log(json.length);

	// headers iterable
	for (const [name, value] of getRes.headers) {
		console.log(name, ':' + value)
	}

	// post
	try {
		const postRes = await fetch(new Request('http://byjka.com/buka'),
			{ method: 'POST', headers: new Headers({ byaka: 'buke' }) })
		const f = await postRes.blob();
		console.log(f.arrayBuffer.length)

	} catch (err) {
		if (err instanceof FetchError) throw err;
		if (err instanceof AbortError) throw err;
	}

	const response = new Response();
	console.log(response.url);
}

run()
