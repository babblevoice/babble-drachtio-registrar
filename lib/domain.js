/*
  domain (class)

  Held by registrar; stores and handles a map of users who are registered

  Methods:

  - reg   Adds a user by username if not present, gets the user and calls user.reg,
          deletes the user if not registered, then returns the registration
  - info  Returns info provided by reg.info for all user registrations
*/

const user = require( "./user.js" )


class domain {

  constructor() {
    this.users = new Map()
  }

  reg( req, registrar ) { // revert to prod class; update test cases

    if ( !this.users.has( req.authorization.username ) ) {
      this.users.set( req.authorization.username, new user( req.authorization ) )
    }

    const u = this.users.get( req.authorization.username )
    const r = u.reg( req, registrar )

    if ( 0 === u.registrations.size ) {
      this.users.delete( u.authorization.username )
    }

    return r
  }

  info( options ) {
    var ua = []
    this.users.forEach( ( u ) => {
      u.registrations.forEach( ( r ) => {
        ua.push( r.info( options ) )
      } )
    } )
    return ua
  }
}

module.exports = domain
