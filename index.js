
const assert = require( "assert" )
const events = require('events')
const digestauth = require( "drachtio-mw-digest-auth" )
const regparser = require( "drachtio-mw-registration-parser" )


/*
Classes

Registrar - our main class
domain - stores a map of users who are registered
user - held by domain sores a list of registrations (each user can have multiple)
reg - an individual registration. each registration can have multiple contact fields.

Our Registrar is our external interface. Srf handles calling us to register with us. We then
provide an interface to query registrations.

Usage:
let r = new Registrar( { "srf": srf, "config": config, "passwordLookup": passwordLookup } )

Get an array of domains with users registered to us, i.e. [ "bling.babblevoice.com" ]
r.realms()

Get all the users and their registrations at a realm
r.users( realm )

Get registrations for a user at a realm
r.user( realm, username )
*/

class reg {
  constructor( req, user ) {
    this.network = {}
    this.network.source_address = req.source_address
    this.network.source_port = req.source_port
    this.network.protocol = req.protocol
    this.callid = req.get( "call-id" )
    this.contact = req.registration.contact
    this.contact.forEach( ( c ) => { c.optionsfailcount = 0 } )
    this.aor = req.registration.aor
    this.expires = req.registration.expires
    this.authorization = user.authorization
    this.user = user
    this.registeredat = Math.floor( +new Date() / 1000 )
    this.optionsintervaltimer = setInterval( this.pingoptions, 30000, this )
    this.regexpiretimer = setTimeout( this.onexpire, this.expires * 1000, this )

    singleton.em.emit( "register", this.info )
  }

  get info() {

    var optionsfailcounttotal = 0
    var contacts = []
    this.contact.forEach( ( c ) => {
      optionsfailcounttotal += c.optionsfailcount
      contacts.push( c.uri )
    } )

    return {
      "callid": this.callid,
      "contacts": contacts,
      "aor": this.aor,
      "expires": this.expires,
      "authorization": this.authorization,
      "registeredat": this.registeredat,
      "network": this.network,
      "expiresat": this.registeredat + this.expires,
      "expiresin": this.registeredat + this.expires - Math.floor( +new Date() / 1000 ),
      "optionsfailcount": optionsfailcounttotal
    }
  }

  update() {
    clearTimeout( this.regexpiretimer )
    this.regexpiretimer = setTimeout( this.onexpire, this.expires * 1000, this )

    this.registeredat = Math.floor( +new Date() / 1000 )

    singleton.em.emit( "register", this.info )
  }

  onexpire( self ) {
    self.user.remove( self )
  }

  destroy() {

    singleton.em.emit( "unregister", this.info )
    clearInterval( this.optionsintervaltimer )
    clearTimeout( this.regexpiretimer )
  }

  pingoptions( self ) {

    self.contact.forEach( ( c ) => {
      c.optionsfailcount++

      if( c.optionsfailcount > 7 ) {
        self.user.remove( self )
        return
      }

      singleton.options.srf.request( c.uri, {
        method: "OPTIONS",
        headers: {
          "Subject": "OPTIONS Ping"
        }
      }, ( err, req ) => {
        if ( err ) {
          console.log( `Error sending OPTIONS: ${err}` )
          return
        }

        req.on( "response", ( res ) => {
          if( 200 == res.status ) {
            c.optionsfailcount--
          }
        } )
      } )
    } )
  }
}

/*
  Handle multiple registrations
*/
class user {
  constructor( authorization ) {
    this.registrations = new Map()
    this.authorization = authorization
  }

  reg( req ) {

    let ci = req.get( "call-id" )

    if( !this.registrations.has( ci ) ) {
      if( 0 === req.registrar.expires ) return

      // New
      this.registrations.set( ci, new reg( req, this ) )
      return
    }

    if( 0 === req.registrar.expires ) {
      this.registrations.get( ci ).destroy()
      this.registrations.delete( ci )
      return
    }

    this.registrations.get( ci ).update()

    console.log( `${this.registrations.size} of registrations for user ${this.authorization.username}` )
  }

  remove( reg ) {
    let callid = reg.callid
    this.registrations.get( callid ).destroy()
    this.registrations.delete( callid )
  }
}

class domain {
  constructor() {
    this.users = new Map()
  }

  reg( req ) {
    if( !this.users.has( req.authorization.username ) ) {
      this.users.set( req.authorization.username, new user( req.authorization ) )
    }

    let u = this.users.get( req.authorization.username )
    u.reg( req )

    if( 0 === u.registrations.size ) {
      this.users.delete( u.authorization.username )
    }
  }

  get info() {
    var ua = []
    this.users.forEach( ( u ) => { u.registrations.forEach( ( r ) => { ua.push( r.info ) } ) } )
    return ua
  }
}

var singleton
class Registrar {

  constructor( options ) {
    singleton = this
    this.options = options
    this.domains = new Map()

    this.options.srf.use( "register", regparser )
    this.options.srf.use( "register", digestauth( {
      proxy: true, /* 407 or 401 */
      passwordLookup: options.passwordLookup
    } ) )

    this.options.srf.use( "register", this.reg )

    this.em = new events.EventEmitter()
  }

  on( event, cb ) {
    this.em.on( event, cb )
  }

  reg( req, res, next ) {
    assert( req.registrar === undefined, "Registrar has been used twice" )

    if ( req.method !== "REGISTER" ) return next()
    req.registrar = {}

    req.registrar.contact = req.get( "Contact" )
    req.registrar.expires = req.registration.expires

    if( req.registrar.expires < 3600 && 0 !== req.registrar.expires ) {
      res.send( 423, { /* Interval too brief - can we pass this in as a config item? */
        headers: {
          "Contact": req.registrar.contact,
          "Min-Expires": 3600
        }
      } )
      return
    }

    if( !singleton.domains.has( req.authorization.realm ) ) {
      singleton.domains.set( req.authorization.realm, new domain() )
    }

    let d = singleton.domains.get( req.authorization.realm )
    d.reg( req )

    res.send( 200, {
      headers: {
        'Contact': req.registrar.contact,
        'Expires': req.registrar.expires
      }
    } )

    if( 0 == d.users.size ) {
      singleton.domains.delete( req.authorization.realm )
    }
  }

  realms() {
    return Array.from( this.domains.keys() )
  }

  /*
    Get all the users and their registrations at a realm
  */
  users( realm ) {
    if( !this.domains.has( realm ) ) {
      return []
    }
    return this.domains.get( realm ).info
  }

  /*
    Get registrations for a user at a realm
  */
  user( realm, username ) {
    if( !this.domains.has( realm ) ) {
      return []
    }

    if( !this.domains.get( realm ).users.has( username ) ) {
      return []
    }

    var ua = []
    this.domains.get( realm ).users.get( username ).registrations.forEach( ( r ) => { ua.push( r.info ) } )
    return ua
  }
}

module.exports = Registrar
