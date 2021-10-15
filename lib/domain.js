
const user = require( "./user.js" )

/**
Represents a domain. Held by the registrar. Stores and handles a map of users who are registered.
@class
*/
class domain {

  /**
  Instantiates the domain class.
  @constructor
  @param { object } options - the Registrar instance options object
  */
  constructor( options ) {

    this.users = new Map()
    this.options = options
  }

  /**
  Handles registration:
  - adds a new user instance by username if not present
  - gets the user and calls user.reg
  - deletes the user if not registered
  - returns the registration
  @method
  @param { Request } req - the incoming request
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
  Gets information on all user registrations:
  - returns an array containing info from reg.info for all user registrations
  @method
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
