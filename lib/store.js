
const domain = require( "./domain.js" )

const bycallidandsource = new Map()
const bydomain = new Map()

function setdomain( reg ) {
  if( bydomain.has( reg._authorization.realm ) ) {
    return bydomain.get( reg._authorization.realm ).set( reg )
  }
  return bydomain.set( reg._authorization.realm, domain.create().set( reg ) )
}

function deletedomain( reg ) {
  if( bydomain.has( reg._authorization.realm ) ) {
    const d = bydomain.get( reg._authorization.realm )
    d.delete( reg )
    if( 0 === d._users.size ) {
      bydomain.delete( reg._authorization.realm )
    }
  }
}

/**
Stores registraion. Always by fully qualifid call-id if authed by domain also.
*/
module.exports.set = ( reg ) => {
  bycallidandsource.set( reg._fqcallid, reg )

  if( "_authorization" in reg && reg._authorization ) {
    setdomain( reg )
  }
}

/**
Retrieve the reg object by call id.
*/
module.exports.get = ( req ) => {
  const fqcallid = req.get( "call-id" ) + "@" + req.source_address + ":" + req.source_port

  if( bycallidandsource.has( fqcallid ) ) {
    return bycallidandsource.get( fqcallid )
  }

  return false
}

/**
Retrieve the domain object by name which contains all registered users.
*/
module.exports.getdomain = ( d ) => {
  if( bydomain.has( d ) ) {
    return bydomain.get( d )
  }

  const newd = domain.create()
  bydomain.set( d, newd )
  return newd
}

module.exports.has = ( domain ) => {
  return bydomain.has( domain )
}

module.exports.delete = ( reg ) => {
  bycallidandsource.delete( reg._fqcallid )

  if( "_authorization" in reg && reg._authorization ) {
    deletedomain( reg )
  }
}

module.exports.clear = () => {
  for (const [key, reg] of bycallidandsource.entries()) {
    reg.destroy()
  }
}

module.exports.realms = () => {
  return Array.from( bydomain.keys() )
}

module.exports.stats = () => {
  return {
    "bycallid": bycallidandsource.size,
    "bydomain": bydomain.size
  }
}

module.exports.getalldomains = () => {
  return bydomain
}