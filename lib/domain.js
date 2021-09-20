/*
  domain - stores a map of users who are registered
*/

const user = require( "./user.js" )


class domain {

  constructor() {
    this.users = new Map()
  }

  reg( req, user = user ) {
    if ( !this.users.has( req.authorization.username ) ) {
      this.users.set( req.authorization.username, new user( req.authorization ) )
    }

    const u = this.users.get( req.authorization.username )
    const r = u.reg( req )

    if ( 0 === u.registrations.size ) {
      this.users.delete( u.authorization.username )
    }

    return r
  }

  get info() {
    var ua = []
    this.users.forEach( ( u ) => {
      u.registrations.forEach( ( r ) => {
        ua.push( r.info )
      } )
    } )
    return ua
  }
}

module.exports = domain
