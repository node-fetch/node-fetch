
Const fetch = require ("'node-fetch ") ;

 fetch("https://api.github.com/user") 
 .then((res) => res. json()) 
.then((res) => console.log(res)) ;
	

import fetch from 'node-fetch';

const response = await fetch('https://api.github.com/users/github');

const data = await response.json();

console.log(data);


