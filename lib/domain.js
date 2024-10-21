
const user = require( "./user" )
const reg = require( "./reg" )

/**
 * Represents a domain. Held by the registrar. Stores and handles a map of users who are registered.
 */
class domain {

  /**
   * Instantiates the domain class.
   */
  constructor() {
    this._users = new Map()
  }

  /**
   * Handles registration:
  -* adds a new user instance by username if not present
  -* gets the user and calls user.reg
  -* deletes the user if not registered
  -* returns the registration
   * @param { reg } reg - the registration
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
   * Retreives a user by username - prioratise expiresin
   * @param { string } user
   * @return { Array.< reg > }
   */
  get( user ) {
    if ( !this._users.has( user ) ) return []

    const u = this._users.get( user )

    const ua = []
    u._registrations.forEach( ( r ) => {
      ua.push( r.info() )
    } )

    ua.sort( ( a, b ) => b.expiresin - a.expiresin )
    return ua
  }

  /**
   * Looks at registration to get the auth object which other methods might want to use
   * @param { object } authreq inbound request we might have an auth in which matches an auth in reg
   */
  getauth( authreq ) {

    const u = this._users.get( authreq.username )
    if( !u ) return

    return u.getauth( authreq )
  }

  /**
   * 
   * @param { object } reg 
   */
  delete( reg ) {
    const u = this._users.get( reg._authorization.username )
    if( !u ) return

    u.delete( reg )
    if ( 0 === u._registrations.size ) {
      this._users.delete( reg._authorization.username )
    }
  }

  /**
   * Gets information on all user registrations:
  -* returns an array containing info from reg.info for all user registrations
   */
  info() {
    const ua = []
    this._users.forEach( ( u ) => {
      u._registrations.forEach( ( r ) => {
        ua.push( r.info() )
      } )
    } )
    return ua
  }

  /**
   * Create a new instance of a domain.
   */
  static create() {
    return new domain()
  }
}

module.exports = domain
