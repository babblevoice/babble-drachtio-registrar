/*
  Registrar - our main class
*/

const assert = require( "assert" )
const events = require( "events" )

const digestauth = require( "drachtio-mw-digest-auth" )
const regparser = require( "drachtio-mw-registration-parser" )
const parseuri = require( "drachtio-srf" ).parseUri

const domain = require( "./domain.js" )
const sendok = require( "./sendok.js" )

let singleton = {}


class Registrar {

  constructor( options ) {

    singleton = this

    /* Our default options */
    this.options = {
      "expires": 3600,
      "minexpires": 3600,
      "staletime": 300,
      "debug": false
    }

    this.options = {
      ...this.options,
      ...options
    }

    this.domains = new Map()

    this.options.srf.use( "register", regparser )
    this.options.srf.use( "register", this.reg )

    if( undefined === this.options.em ) {
      this.options.em = new events.EventEmitter()
    }

    if( this.options.debug ) {
      this.consolelog = ( m ) => {
        console.log( "Registrar: " + m )
      }
    } else {
      this.consolelog = ( m ) => {}
    }
  }

  on( event, cb ) {
    this.options.em.on( event, cb )
  }

  reg( req, res, next ) {
    assert( req.registrar === undefined, "Registrar has been used twice" )

    if ( req.method !== "REGISTER" ) return next()
    req.registrar = {}

    let parsedaor = parseuri( req.registration.aor )
    let reg = singleton.isauthed( parsedaor.host, parsedaor.user, req )

    /* Unreg */
    if ( 0 === req.registration.expires && reg ) {
      reg.onexpire( reg, singleton.options )
    }

    let r = false
    if ( !reg || reg.expiring ) {
      //console.log( "Requesting auth" )
      let uri = req.getParsedHeader( "To" ).uri
      singleton.consolelog( `Requesting auth for ${uri}` )

      let toparts = parseuri( uri )
      var authed = false
      digestauth( {
        "proxy": true, /* 407 or 401 */
        "passwordLookup": ( username, realm, cb ) => {
          singleton.options.userlookup( username, realm )
            .then( ( u ) => {
              cb( false, u.secret )
            } )
            .catch( () => {
              cb( false, false )
            } )
        },
        "realm": toparts.host
      } )( req, res, () => {

        /* User has been authed */
        req.registrar.contact = req.get( "Contact" )
        req.registrar.useragent = req.get( "user-agent" )

        req.registrar.allow = req.get( "allow" )
        if( undefined === req.registrar.allow &&
            undefined !== req.registration.contact[ 0 ].params.methods ) {
          req.registrar.allow = req.registration.contact[ 0 ].params.methods.replace( /^\"|"$/g, "" )
        }
        req.registrar.expires = req.registration.expires

        if ( undefined === singleton.options.regping &&
          undefined !== singleton.options.minexpires &&
          req.registrar.expires < singleton.options.minexpires &&
          0 !== req.registrar.expires ) {
          res.send( 423, {
            /* Interval too brief - can we pass this in as a config item? */
            headers: {
              "Contact": req.registrar.contact,
              "Min-Expires": singleton.options.minexpires
            }
          } )
          return
        }

        if ( !singleton.domains.has( req.authorization.realm ) ) {
          singleton.domains.set( req.authorization.realm, new domain() )
        }

        let d = singleton.domains.get( req.authorization.realm )
        r = d.reg( req, singleton )

        if ( 0 == d.users.size ) {
          singleton.domains.delete( req.authorization.realm )
        }

        sendok( req, res, singleton.options )
        if ( false !== r && undefined !== r ) {
          singleton.options.em.emit( "register", r.getinfo( singleton.options ) )
        }
      } )
    } else if ( reg ) {
      reg.regping()
      sendok( req, res, singleton.options )
    }
  }

  isauthed( realm, user, req ) {

    if ( !this.domains.has( realm ) ) {
      return false
    }

    if ( !this.domains.get( realm ).users.has( user ) ) {
      return false
    }

    let ci = req.get( "call-id" )

    for ( const [ key, reg ] of this.domains.get( realm ).users.get( user ).registrations ) {
      if ( req.source_address === reg.network.source_address &&
        req.source_port === reg.network.source_port &&
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
    if ( !this.domains.has( realm ) ) {
      return []
    }
    return this.domains.get( realm ).getinfo( singleton.options )
  }

  /*
    Get registrations for a user at a realm
    Either:
    user( "bling.babblevoice.com", "1000" )
    or
    user( "sip:1000@bling.babblevoice.com" )

    Change to async for future devel to store regs in redis or similar
  */
  async user( realm, username ) {

    if ( undefined == username ) {
      let parsed = parseuri( realm )
      realm = parsed.host
      username = parsed.user
    }

    if ( !this.domains.has( realm ) ) {
      return []
    }

    if ( !this.domains.get( realm ).users.has( username ) ) {
      return []
    }

    var ua = []
    this.domains.get( realm ).users.get( username ).registrations.forEach( ( r ) => {
      ua.push( r.getinfo( singleton.options ) )
    } )
    return ua
  }
}

const getsingleton = function() {
  return singleton
}

const setsingleton = function( obj ) {
  singleton = obj
}

module.exports = { Registrar, getsingleton, setsingleton }
