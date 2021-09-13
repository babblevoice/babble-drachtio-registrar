let singleton = {}

const getSingleton = function() {
  return singleton
}

const setSingleton = function( obj ) {
  singleton = obj
}

module.exports = { getSingleton, setSingleton }
