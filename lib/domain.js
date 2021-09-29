
const user = require( "./user.js" )

/**
  * Represents a domain. Held by the registrar. Stores and handles a map of users who are registered.
  * @class
 */
class domain {

  /** */
  constructor( options ) {

    this.users = new Map()
    this.options = options
  }

  /**
    * Handles registration:
    * <br> - adds a new user instance by username if not present
    * <br> - gets the user and calls user.reg
    * <br> - deletes the user if not registered
    * <br> - returns the registration
    * @method
    * @param { Request } req
  */
  reg( req ) {

    if ( !this.users.has( req.authorization.username ) ) {
      this.users.set( req.authorization.username, new user( req.authorization, this.options ) )
    }

    const u = this.users.get( req.authorization.username )
    const r = u.reg( req )

    if ( 0 === u.registrations.size ) {
      this.users.delete( u.authorization.username )
    }

    return r
  }

  /**
    * Gets information on all user registrations:
    * <br> - returns an array containing info from reg.info for all user registrations
    * @method
  */
  info() {
    var ua = []
    this.users.forEach( ( u ) => {
      u.registrations.forEach( ( r ) => {
        ua.push( r.info() )
      } )
    } )
    return ua
  }
}

module.exports = domain
