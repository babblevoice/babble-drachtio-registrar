
const user = require( "./user.js" )

/**
Represents a domain. Held by the registrar. Stores and handles a map of users who are registered.
@class
*/
class domain {

  /**
  Instantiates the domain class.
  @constructor
  */
  constructor() {
    this._users = new Map()
  }

  /**
  Handles registration:
  - adds a new user instance by username if not present
  - gets the user and calls user.reg
  - deletes the user if not registered
  - returns the registration
  @param { reg } reg - the registration
  */
  set( reg ) {
    let u
    if ( !this._users.has( reg._authorization.username ) ) {
      u = user.create()
      this._users.set( reg._authorization.username, u )
    } else {
      u = this._users.get( reg._authorization.username )
    }

    u.set( reg )
    return this
  }
  /**
  Retreives a user by username
  @param { string } user
  @return {Array.<registrations>}
  */
  get( user ) {
    if ( !this._users.has( user ) ) return []

    let u = this._users.get( user )

    let ua = []
    u._registrations.forEach( ( r ) => {
      ua.push( r.info() )
    } )
    return ua
  }

  delete( reg ) {
    const u = this._users.get( reg._authorization.username )
    if( !u ) return

    u.delete( reg )
    if ( 0 === u._registrations.size ) {
      this._users.delete( reg._authorization.username )
    }
  }

  /**
  Gets information on all user registrations:
  - returns an array containing info from reg.info for all user registrations
  */
  info() {
    let ua = []
    this._users.forEach( ( u ) => {
      u._registrations.forEach( ( r ) => {
        ua.push( r.info() )
      } )
    } )
    return ua
  }

  /**
  Create a new instance of a domain.
  */
  static create() {
    return new domain()
  }
}

module.exports = domain
