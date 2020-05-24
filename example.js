const fetch = require('node-fetch');

// Plain text or HTML
(async () => {
	const response = await fetch('https://github.com/');
	const body = await response.text();

	console.log(body);
})();

// JSON
(async () => {
	const response = await fetch('https://github.com/');
	const json = await response.json();

	console.log(json);
})();

// Simple Post
(async () => {
	const response = await fetch('https://httpbin.org/post', {method: 'POST', body: 'a=1'});
	const json = await response.json();

	console.log(json);
})();

// Post with JSON
(async () => {
	const body = {a: 1};

	const response = await fetch('https://httpbin.org/post', {
		method: 'post',
		body: JSON.stringify(body),
		headers: {'Content-Type': 'application/json'}
	});
	const json = await response.json();

	console.log(json);
})();
