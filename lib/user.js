/*
  user (class)

  Held by domain; stores and handles a map of user registrations

  Methods:

  - reg     Adds and returns a registration by call ID if not present, or returns if expired,
            else calls the remove method for a registration and returns,
            else gets a registration, calls reg.update and the options.consolelog method and returns it
  - remove  Calls reg.destroy for a registration found by call ID then deletes it
*/

const reg = require( "./reg.js" )


class user {

  constructor( authorization, options ) {

    this.registrations = new Map()
    this.authorization = authorization
    this.options = options
  }

  reg( req ) {

    const ci = req.get( "call-id" )

    if ( !this.registrations.has( ci ) ) {
      if ( 0 === req.registrar.expires ) return

      // Add new registration
      const r = new reg( req, this )
      this.registrations.set( ci, r )
      return r
    }

    // Remove registration
    if ( 0 === req.registrar.expires ) {
      this.remove( ci )
      return
    }

    // Update registration
    let r = this.registrations.get( ci )
    r.update()
    this.options.consolelog( `${this.registrations.size} registration(s) for user ${this.authorization.username}` )
    return r
  }

  remove( ci ) {
    this.registrations.get( ci ).destroy()
    this.registrations.delete( ci )
  }
}

module.exports = user
