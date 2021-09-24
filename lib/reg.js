/*
  reg (class)

  Held by user; a registration, allowed multiple contact fields

  Methods:

  - info         ...
  - update       ...
  - regping      ...
  - onexpire     ...
  - destroy      ...
  - pingoptions  ...
*/

const { v4: uuidv4 } = require( "uuid" )


class reg {

  constructor( req, user ) {

    this.uuid = uuidv4()
    this.initial = true

    this.network = {}
    this.network.source_address = req.source_address
    this.network.source_port = req.source_port
    this.network.protocol = req.protocol

    this.useragent = undefined === req.registrar.useragent ? "" : req.registrar.useragent
    this.allow = req.registrar.allow.toUpperCase().split( /[\s,]+/ )

    this.callid = req.get( "call-id" )

    this.contact = req.registration.contact
    this.aor = req.registration.aor
    this.expires = req.registration.expires

    this.user = user
    this.authorization = user.authorization
    this.options = user.options

    if ( undefined !== user.options.regping ) {
      this.expires = user.options.expires
    }
    this.registeredat = Math.floor( +new Date() / 1000 )
    this.ping = Math.floor( +new Date() / 1000 )

    if ( undefined !== user.options.optionsping ) {
      this.optionsintervaltimer = setInterval( this.pingoptions, user.options.optionsping * 1000, this )
    }

    this.regexpiretimer = setTimeout( this.onexpire, this.expires * 1000, this )
  }

  get expired() {
    return ( this.registeredat + this.expires ) < Math.floor( +new Date() / 1000 )
  }

  /* Expired - but with some buffer */
  get expiring() {
    return ( this.registeredat + ( this.expires / 2 ) ) < Math.floor( +new Date() / 1000 )
  }

  info() {
    const contacts = []
    this.contact.forEach( ( c ) => {
      contacts.push( c.uri )
    } )

    return {
      "uuid": this.uuid,
      "initial": this.initial,
      "callid": this.callid,
      "contacts": contacts,
      "aor": this.aor,
      "expires": this.expires,
      "authorization": this.authorization,
      "registeredat": this.registeredat,
      "useragent": this.useragent,
      "allow": this.allow,
      "network": this.network,
      "expiresat": this.registeredat + this.expires,
      "expiresin": this.registeredat + this.expires - Math.floor( +new Date() / 1000 ),
      "stale": this.ping < ( Math.floor( +new Date() / 1000 ) - this.options.staletime )
    }
  }

  /* Called by our frame work on further packets */
  update() {
    clearTimeout( this.regexpiretimer )
    this.regexpiretimer = setTimeout( this.onexpire, this.expires * 1000, this )
    this.registeredat = Math.floor( +new Date() / 1000 )
    this.initial = false
  }

  /* Called when we receive a register which we use instead of options ping */
  regping() {
    this.ping = Math.floor( +new Date() / 1000 )
  }

  onexpire( self ) {
    const ci = self.callid
    self.user.remove( ci, this.options )
  }

  destroy() {
    this.options.em.emit( "unregister", this.info( this.options ) )
    clearInterval( this.optionsintervaltimer )
    clearTimeout( this.regexpiretimer )
  }

  pingoptions( self ) {

    const opts = {
      method: "OPTIONS",
      headers: {
        "Subject": "OPTIONS Ping"
      }
    }

    const cb = ( err, req ) => {
      if ( err ) {
        this.options.consolelog( `Error sending OPTIONS: ${ err }` )
        return
      }
      req.on( "response", ( res ) => {
        if ( 200 == res.status ) {
          self.ping = Math.floor( +new Date() / 1000 )
        }
      } )
    }

    self.contact.forEach( c => {
      this.options.srf.request( c.uri, opts, cb )
    } )
  }
}

module.exports = reg
