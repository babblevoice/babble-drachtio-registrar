/*
  domain - stores a map of users who are registered
*/

const user = require( "./user.js" )


class domain {

  constructor() {
    this.users = new Map()
  }

  reg( req, singleton, user = user ) { // revert to prod class; update test cases

    if ( !this.users.has( req.authorization.username ) ) {
      this.users.set( req.authorization.username, new user( req.authorization ) )
    }

    const u = this.users.get( req.authorization.username )
    const r = u.reg( req, singleton )

    if ( 0 === u.registrations.size ) {
      this.users.delete( u.authorization.username )
    }

    return r
  }

  getinfo( options ) { // for all user registrations
    var ua = []
    this.users.forEach( ( u ) => {
      u.registrations.forEach( ( r ) => {
        ua.push( r.getinfo( options ) )
      } )
    } )
    return ua
  }
}

module.exports = domain
