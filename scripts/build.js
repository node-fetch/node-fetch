/**
 * Build script.
 *
 * node-fetch v3 is authored as ES modules in src/ (the canonical `import`
 * entry point), but it also ships a CommonJS build so that `require('node-fetch')`
 * keeps working on every supported Node.js version (>= 12.20) and in tooling
 * that cannot load ES modules (Jest, older bundlers, ts-node CJS, ...).
 *
 * The CommonJS build is a self-contained bundle (lib/index.cjs) produced from
 * scripts/cjs-entry.cjs, which re-exports the ESM entry with the exact same
 * module shape that node-fetch v2 had:
 *
 *   const fetch = require('node-fetch'); // callable, like v2
 *   fetch.default === fetch;             // ESM default interop
 *   const {Headers} = require('node-fetch'); // named exports
 *
 * Run with `npm run build`. Executed automatically by `pretest`, `prepare`
 * and `prepublishOnly`.
 */

import {mkdir, rm} from 'node:fs/promises';
import {build} from 'esbuild';

async function main() {
	const common = {
		// Bundle the runtime dependencies (data-uri-to-buffer is ESM-only, so it
		// cannot be require()'d directly) into a single self-contained file.
		// Node.js builtins stay external automatically with platform: 'node'.
		bundle: true,
		platform: 'node',
		// Lowest supported version, see "engines" in package.json. esbuild
		// transpiles newer syntax (optional chaining, class fields, ...) down.
		target: ['node12.20'],
		sourcemap: true,
		logLevel: 'info'
	};

	await rm('lib', {recursive: true, force: true});
	await mkdir('lib', {recursive: true});

	// CommonJS entry, resolved through the "require" condition of the "exports"
	// map and through the legacy "main" field.
	await build({
		...common,
		entryPoints: ['scripts/cjs-entry.cjs'],
		format: 'cjs',
		outfile: 'lib/index.cjs'
	});
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
