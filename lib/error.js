/**
 * error.js
 *
 * Helper function for creating a TypeError with a code
 */

module.exports = error;

/**
 * Create TypeError
 *
 * @param   String  reason  String code
 * @return  TypeError
 */
function error(reason, code) {
  var error = new TypeError(reason);
  error.code = code;
  return error;
}
