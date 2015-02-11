var fs = require('fs');
var fetch = fs.readFileSync(__dirname + '/node_modules/whatwg-fetch/fetch.js');

fetch += '\nmodule.exports = self.fetch;\n';

fs.writeFileSync(__dirname + '/browser-fetch.js',fetch,'utf8');
