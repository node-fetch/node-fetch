const fetch = require('node-fetch');

// Plain text or HTML
fetch('https://github.com/')
	.then(response => response.text())
	.then(body => console.log(body));

// JSON
fetch('https://api.github.com/users/github')
	.then(response => response.json())
	.then(json => console.log(json));

// Simple Post
fetch('https://httpbin.org/post', {method: 'POST', body: 'a=1'})
	.then(response => response.json())
	.then(json => console.log(json));

// Post with JSON
const body = {a: 1};

fetch('https://httpbin.org/post', {
	method: 'post',
	body: JSON.stringify(body),
	headers: {'Content-Type': 'application/json'}
})
	.then(response => response.json())
	.then(json => console.log(json));
