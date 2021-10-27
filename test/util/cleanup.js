/* Clears the regexpiretimer property on a reg instance */

const clearTimer = function( instance ) {
  clearTimeout( instance.regexpiretimer )
}

module.exports = { clearTimer }
