/*
  user - held by domain; stores and handles a list of registrations (each user can have multiple)
*/

const { getSingleton } = require( "./singleton.js" )
const reg = require( "./reg.js" )


class user {

  constructor( authorization ) {

    this.registrations = new Map()
    this.authorization = authorization
  }

  reg( req ) {

    let ci = req.get( "call-id" )

    if ( !this.registrations.has( ci ) ) {
      if ( 0 === req.registrar.expires ) return

      // New
      let r = new reg( req, this )
      this.registrations.set( ci, r )
      return r
    }

    if ( 0 === req.registrar.expires ) {
      this.registrations.get( ci ).destroy()
      this.registrations.delete( ci )
      return
    }

    let r = this.registrations.get( ci )
    r.update()

    getSingleton().consolelog( `${this.registrations.size} of registrations for user ${this.authorization.username}` )
    return r
  }

  remove( r ) {
    let callid = r.callid
    this.registrations.get( callid ).destroy()
    this.registrations.delete( callid )
  }
}

module.exports = user
