let singleton = {}

const get = function() {
  return singleton
}

const set = function( obj ) {
  singleton = obj
}

module.exports = { get, set }
