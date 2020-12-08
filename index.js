
'use strict'

const assert = require( "assert" )
const events = require('events')
const digestauth = require( "drachtio-mw-digest-auth" )
const regparser = require( "drachtio-mw-registration-parser" )
const parseuri = require( "drachtio-srf" ).parseUri


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
    this.useragent = req.registrar.useragent
    this.callid = req.get( "call-id" )
    this.contact = req.registration.contact
    this.aor = req.registration.aor
    this.expires = req.registration.expires
    if( undefined !== singleton.options.regping ) {
      this.expires = singleton.options.expires
    }
    this.authorization = user.authorization
    this.user = user
    this.registeredat = Math.floor( +new Date() / 1000 )
    this.ping = Math.floor( +new Date() / 1000 )

    if( undefined !== singleton.options.optionsping ) {
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
    var contacts = []
    this.contact.forEach( ( c ) => {
      contacts.push( c.uri )
    } )

    return {
      "callid": this.callid,
      "contacts": contacts,
      "aor": this.aor,
      "expires": this.expires,
      "authorization": this.authorization,
      "registeredat": this.registeredat,
      "useragent": this.useragent,
      "network": this.network,
      "expiresat": this.registeredat + this.expires,
      "expiresin": this.registeredat + this.expires - Math.floor( +new Date() / 1000 ),
      "stale": this.ping < ( Math.floor( +new Date() / 1000 ) - singleton.options.staletime )
    }
  }

  update() {
    clearTimeout( this.regexpiretimer )
    this.regexpiretimer = setTimeout( this.onexpire, this.expires * 1000, this )

    this.registeredat = Math.floor( +new Date() / 1000 )
  }

  /* Called when we receive a register which we use instead of options ping */
  regping() {
    this.ping = Math.floor( +new Date() / 1000 )
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
      singleton.options.srf.request( c.uri, {
        method: "OPTIONS",
        headers: {
          "Subject": "OPTIONS Ping"
        }
      }, ( err, req ) => {
        if ( err ) {
          //console.log( `Error sending OPTIONS: ${err}` )
          return
        }

        req.on( "response", ( res ) => {
          if( 200 == res.status ) {
            self.ping = Math.floor( +new Date() / 1000 )
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
      let r = new reg( req, this )
      this.registrations.set( ci, r )
      return r
    }

    if( 0 === req.registrar.expires ) {
      this.registrations.get( ci ).destroy()
      this.registrations.delete( ci )
      return
    }

    let r = this.registrations.get( ci )
    r.update()
    return r
    //console.log( `${this.registrations.size} of registrations for user ${this.authorization.username}` )
  }

  remove( r ) {
    let callid = r.callid
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
    let r = u.reg( req )

    if( 0 === u.registrations.size ) {
      this.users.delete( u.authorization.username )
    }

    return r
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

    this.option = {
      "expires": 3600,
      "minexpires": 3600,
      "staletime": 300
    }
    
    this.options = { ...this.options, ...options }

    this.options = options
    this.domains = new Map()

    this.authdigest = digestauth( {
      proxy: true, /* 407 or 401 */
      passwordLookup: options.passwordLookup
    } )

    this.options.srf.use( "register", regparser )
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

    let parsedaor = parseuri( req.registration.aor )
    let reg = singleton.isauthed( parsedaor.host, parsedaor.user, req )

    /* Unreg */
    if( 0 === req.registration.expires && reg ) {
      reg.onexpire( reg )
    }

    if( !reg || reg.expiring ) {
      //console.log( "Requesting auth" )
      var authed = false
      singleton.authdigest( req, res, () => { authed = true } )
      if( !authed ) {
        return
      }

      req.registrar.contact = req.get( "Contact" )
      req.registrar.useragent = req.get( "user-agent" )
      req.registrar.expires = req.registration.expires

      if( undefined === singleton.options.regping &&
          undefined !== singleton.options.minexpires &&
          req.registrar.expires < singleton.options.minexpires &&
          0 !== req.registrar.expires ) {
            res.send( 423, { /* Interval too brief - can we pass this in as a config item? */
              headers: {
                "Contact": req.registrar.contact,
                "Min-Expires": singleton.options.minexpires
              }
            } )
            next()
            return
      }

      if( !singleton.domains.has( req.authorization.realm ) ) {
        singleton.domains.set( req.authorization.realm, new domain() )
      }

      let d = singleton.domains.get( req.authorization.realm )
      let r = d.reg( req )

      if( 0 == d.users.size ) {
        singleton.domains.delete( req.authorization.realm )
      }

      if( r ) {
        singleton.em.emit( "register", r.info )
      }
    } else if( reg ) {
      reg.regping()
    }

    if( undefined !== singleton.options.regping ) {
      res.send( 200, {
        headers: {
              "Contact": req.get( "Contact" ).replace( /expires=\d+/, `expires=${singleton.options.regping}` ),
              "Expires": singleton.options.regping
            }
      } )
    } else {
      res.send( 200, {
        headers: {
          "Contact": req.registrar.contact,
          "Expires": req.registrar.expires
        }
      } )
    }

    next()
  }

  isauthed( realm, user, req ) {

    if( !this.domains.has( realm ) ) {
      return false
    }

    if( !this.domains.get( realm ).users.has( user ) ) {
      return false
    }

    let ci = req.get( "call-id" )

    for ( const [ key, reg ] of this.domains.get( realm ).users.get( user ).registrations) {
      if( req.source_address === reg.network.source_address &&
          req.source_port === reg.network.source_port  &&
          ci === reg.callid ) {
            return reg
          }
    }

    return false
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
    Either:
    user( "bling.babblevoice.com", "1000" )
    or
    user( "sip:1000@bling.babblevoice.com" )
  */
  user( realm, username ) {

    if( undefined == username ) {
      let parsed = parseuri( realm )
      realm = parsed.host
      username = parsed.user
    }

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
