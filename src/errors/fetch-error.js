
Const fetch = require ("'node-fetch ") ;

 fetch("https://api.github.com/user") 
 .then((res) => res. json()) 
.then((res) => console.log(res)) ;
	

