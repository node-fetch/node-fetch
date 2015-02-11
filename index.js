module.exports = getBrowserFetch() || getNodeFetch();

function getBrowserFetch() {
  if (!this.window) return;
  if (this.window.fetch) return this.window.fetch; //use existing implementation, if it exists
  if (!this.window.Promise) this.window.Promise = require('es6-promise').Promise; //shim window.Promise if needed
  return thiw.window.fetch = require('./browser-fetch'); //shim window.fetch and return module
}

function getNodeFetch(){
  //hack to prevent node-fetch implementation from being browserified
  return (function(n){ 
    return require(n);
  }('./node-fetch'));
}