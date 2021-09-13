/*
  domain - stores a map of users who are registered
*/

class domain {

  constructor() {
    this.users = new Map()
  }

  reg( req ) {
    if ( !this.users.has( req.authorization.username ) ) {
      this.users.set( req.authorization.username, new user( req.authorization ) )
    }

    let u = this.users.get( req.authorization.username )
    let r = u.reg( req )

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
