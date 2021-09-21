/*
  user - held by domain; stores and handles a list of registrations (each user can have multiple)
*/

const reg = require( "./reg.js" )


class user {

  constructor( authorization ) {

    this.registrations = new Map()
    this.authorization = authorization
  }

  reg( req, registrar ) {

    const ci = req.get( "call-id" )

    if ( !this.registrations.has( ci ) ) {
      if ( 0 === req.registrar.expires ) return

      // Add new registration
      const r = new reg( req, this, registrar )
      this.registrations.set( ci, r )
      return r
    }

    // Remove registration
    if ( 0 === req.registrar.expires ) {
      this.remove( ci, registrar.options )
      return
    }

    // Update registration
    let r = this.registrations.get( ci )
    r.update( registrar.options )
    registrar.consolelog( `${this.registrations.size} registration(s) for user ${this.authorization.username}` )
    return r
  }

  remove( ci, options ) {
    this.registrations.get( ci ).destroy( options )
    this.registrations.delete( ci )
  }
}

module.exports = user
