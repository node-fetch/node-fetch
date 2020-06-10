'use strict';

// Use --experimental-worker will need Nodejs v10.5.0 until 11.7
const {builtinModules} = require('module');
module.exports = builtinModules.includes('worker_threads') ? require('worker_threads').Worker : false;
