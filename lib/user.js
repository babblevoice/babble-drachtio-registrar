/*
  user - held by domain; stores and handles a list of registrations (each user can have multiple)
*/

const reg = require( "./reg.js" )


class user {

  constructor( authorization ) {

    this.registrations = new Map()
    this.authorization = authorization
  }

  reg( req, singleton ) {

    const ci = req.get( "call-id" )

    if ( !this.registrations.has( ci ) ) {
      if ( 0 === req.registrar.expires ) return

      // Add new reg
      const r = new reg( req, this )
      this.registrations.set( ci, r )
      return r
    }

    // Remove reg
    if ( 0 === req.registrar.expires ) {
      this.remove( ci )
      return
    }

    // Update reg
    let r = this.registrations.get( ci )
    r.update()
    singleton.consolelog( `${this.registrations.size} registrations for user ${this.authorization.username}` )
    return r
  }

  remove( ci ) {
    this.registrations.get( ci ).destroy()
    this.registrations.delete( ci )
  }
}

module.exports = user
