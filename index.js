module.exports = getBrowserFetch() || getNodeFetch();

function getBrowserFetch() {
  if (!this.window) return;
  if (this.window.fetch) return this.window.fetch; //use existing implementation
  return require('./browser-fetch');
}

function getNodeFetch(){
  //hack to prevent node-fetch implementation from being browserified
  return (function(n){ 
    return require(n); 
  }('./node-fetch'));
}