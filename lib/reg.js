/*
  reg - an individual registration, each of which can have multiple contact fields
*/

const { v4: uuidv4 } = require( "uuid" )

const { getSingleton } = require( "./singleton.js" )


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

    const singleton = getSingleton()

    if ( undefined !== singleton.options.regping ) {
      this.expires = singleton.options.expires
    }
    this.authorization = user.authorization
    this.user = user
    this.registeredat = Math.floor( +new Date() / 1000 )
    this.ping = Math.floor( +new Date() / 1000 )
    if ( undefined !== singleton.options.optionsping ) {
      this.optionsintervaltimer = setInterval( this.pingoptions, singleton.options.optionsping * 1000, this )
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

  get info() {
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
      "stale": this.ping < ( Math.floor( +new Date() / 1000 ) - getSingleton().options.staletime )
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
    self.user.remove( ci )
  }

  destroy() {
    const singleton = getSingleton()
    singleton.options.em.emit( "unregister", this.info )
    clearInterval( this.optionsintervaltimer )
    clearTimeout( this.regexpiretimer )
  }

  pingoptions( self ) {

    const singleton = getSingleton()
    self.contact.forEach( ( c ) => {
      singleton.options.srf.request( c.uri, {
        method: "OPTIONS",
        headers: {
          "Subject": "OPTIONS Ping"
        }
      }, ( err, req ) => {
        if ( err ) {
          singleton.consolelog( `Error sending OPTIONS: ${err}` )
          return
        }

        req.on( "response", ( res ) => {
          if ( 200 == res.status ) {
            self.ping = Math.floor( +new Date() / 1000 )
          }
        } )
      } )
    } )
  }
}

module.exports = reg
