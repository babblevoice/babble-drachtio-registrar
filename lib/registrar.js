
const assert = require( "assert" )
const events = require( "events" )

const digestauthentication = require( "drachtio-mw-digest-auth" )
const registrationparser = require( "drachtio-mw-registration-parser" )
const parseuri = require( "drachtio-srf" ).parseUri

const domain = require( "./domain.js" )

/**
External interface, primary class. Stores and handles a map of domains.
@class
*/
class Registrar {

  /**
  Instantiates the Registrar class.
  @constructor
  @param { object } options - the object extending or overriding the defaults
  @param { function } regparser - drachtio middleware parsing registration messages
  */
  constructor( options, regparser = registrationparser ) {

    const defaults = {
      expires: 3600,
      minexpires: 3600,
      staletime: 300,
      debug: false
    }

    this.options = {
      ...defaults,
      ...options
    }

    this.domains = new Map()

    this.options.srf.use( "register", regparser )
    this.options.srf.use( "register", this.reg.bind( this ) )

    if( undefined === this.options.em ) {
      this.options.em = new events.EventEmitter()
    }

    if( this.options.debug ) {
      this.options.consolelog = m => {
        console.log( "Registrar: " + m )
      }
    } else {
      this.options.consolelog = m => {}
    }
  }
  /**
  Sets an event listener:
  - sets an event listener on the options.em property for an event and a callback passed
  @method
  @param { string } event - the name of the event
  @param { function } cb - the callback
  */
  on( event, cb ) {
    this.options.em.on( event, cb )
  }

  /**
  Handles registration:
  - throws an error if the registrar instance has been used more than once
  - invokes next if the request method is not REGISTER
  - parses the req.registration.aor property and calls the _isauthed method to get the registration
  - if the registration is returned, calls reg.onexpire if expired else calls reg.regping and the _sendok method passing the request and response
  - else parses the request To header URI, logs it via the options.consolelog method and passes to the digest authentication function:
    - an options object containing the host parsed and a passwordLookup callback
    - the request, the response and an onauth callback which:
      - sets the req.registrar.contact, .useragent, .allow and .expires properties
      - calls res.send and returns if the options.regping method is not present and the req.registrar.expires property is non-zero and less than the options.minexpires property
      - adds a new domain instance by realm if not present
      - gets the domain, calls domain.reg and emits the register event with information on the registration
      - deletes the domain if no users are present
      - calls the _sendok method passing the request and response
  @method
  @param { Request } req - the incoming request
  @param { Response } res - the outgoing response
  @param { function } next - a callback
  @param { function } digestauth - drachtio middleware performing digest-based authentication
  */
  reg( req, res, next, digestauth = digestauthentication ) {

    assert( req.registrar === undefined, "Registrar has been used twice" )

    if ( req.method !== "REGISTER" ) return next()

    req.registrar = {}

    const parsedaor = parseuri( req.registration.aor )
    const reg = this._isauthed( parsedaor.host, parsedaor.user, req )

    /* Unreg */
    if ( 0 === req.registration.expires && reg ) {
      reg.onexpire()
    }

    let r = false
    if ( !reg || reg.expiring ) {

      const uri = req.getParsedHeader( "To" ).uri
      this.options.consolelog( `Requesting auth for ${ uri }` )

      const toparts = parseuri( uri )

      const passwordLookup = ( username, realm, cb ) => {
        this.options.userlookup( username, realm )
          .then( ( u ) => {
            cb( false, u.secret )
          } )
          .catch( () => {
            cb( false, false )
          } )
      }

      const options = {
        proxy: true, /* 407 or 401 */
        passwordLookup,
        realm: toparts.host
      }

      const onauth = () => {

        req.registrar.contact = req.get( "Contact" )
        req.registrar.useragent = req.get( "user-agent" )

        req.registrar.allow = req.get( "allow" )
        if( undefined === req.registrar.allow &&
            undefined !== req.registration.contact[ 0 ].params.methods ) {
          req.registrar.allow = req.registration.contact[ 0 ].params.methods.replace( /^\"|"$/g, "" )
        }
        req.registrar.expires = req.registration.expires

        if ( undefined === this.options.regping &&
          undefined !== this.options.minexpires &&
          req.registrar.expires < this.options.minexpires &&
          0 !== req.registrar.expires ) {
          res.send( 423, {
            /* Interval too brief - can we pass this in as a config item? */
            headers: {
              Contact: req.registrar.contact,
              "Min-Expires": this.options.minexpires
            }
          } )
          return
        }

        if ( !this.domains.has( req.authorization.realm ) ) {
          this.domains.set( req.authorization.realm, new domain( this.options ) )
        }

        const d = this.domains.get( req.authorization.realm )
        r = d.reg( req )

        if ( 0 == d.users.size ) {
          this.domains.delete( req.authorization.realm )
        }

        this._sendok( req, res )
        if ( r ) {
          this.options.em.emit( "register", r.info() )
        }
      }

      const challenge = digestauth( options )
      challenge( req, res, onauth )

    } else if ( reg ) {
      reg.regping()
      this._sendok( req, res )
    }
  }

  /**
  Gets a user registration:
  - returns a registration by realm and username if present if source address, source port and call ID match
  - else returns false
  @private
  @method
  @param { string } realm - the name of the user domain
  @param { string } username - the name of the user
  @param { Request } req - the incoming request
  */
  _isauthed( realm, username, req ) {

    if ( !this.domains.has( realm ) || !this.domains.get( realm ).users.has( username ) ) {
      return false
    }

    const ci = req.get( "call-id" )

    for ( const [ key, reg ] of this.domains.get( realm ).users.get( username ).registrations ) {
      if ( req.source_address === reg.network.source_address &&
        req.source_port === reg.network.source_port &&
        ci === reg.callid ) {
        return reg
      }
    }

    return false
  }

  /**
  Sends a success response:
  - sets headers using the request Contact header and options regping property if the latter is present
  - else sets headers using the request registrar contact and expires properties
  @private
  @method
  @param { Request } req - the incoming request
  @param { Response } res - the outgoing response
  */
  _sendok( req, res ) {

    if ( undefined !== this.options.regping ) {
      res.send( 200, {
        headers: {
          Contact: req.get( "Contact" ).replace( /expires=\d+/, `expires=${ this.options.regping }` ),
          Expires: this.options.regping
        }
      } )
    } else {
      res.send( 200, {
        headers: {
          Contact: req.registrar.contact,
          Expires: req.registrar.expires
        }
      } )
    }
  }

  /**
  Gets the names of all domains:
  - returns an array containing the keys of the domains property
  @method
  */
  realms() {
    return Array.from( this.domains.keys() )
  }

  /**
  Gets information on all user registrations for a realm:
  - returns an array containing info from reg.info for all user registrations at a realm if present
  - else returns an empty array
  @method
  @param { string } realm - the name of the domain
  */
  users( realm ) {
    if ( !this.domains.has( realm ) ) {
      return []
    }
    return this.domains.get( realm ).info()
  }

  /**
  Gets information on all registrations for a user at a realm:
  - parses the host and username from the realm if the username is not passed
  - returns an array containing info from reg.info for all registrations for the user if present
  - else returns an empty array

  Usage options:
  - user("bling.babblevoice.com", "1000")
  - user("sip:1000@bling.babblevoice.com")

  Method async for future storage of registrations in Redis or similar.
  @method
  @param { string } realm - the name of the domain, or the full address
  @param { string } username - the name of the user
  */
  async user( realm, username ) {

    if ( undefined == username ) {
      const parsed = parseuri( realm )
      realm = parsed.host
      username = parsed.user
    }

    if ( !this.domains.has( realm ) || !this.domains.get( realm ).users.has( username ) ) {
      return []
    }

    var ua = []
    this.domains.get( realm ).users.get( username ).registrations.forEach( ( r ) => {
      ua.push( r.info() )
    } )
    return ua
  }
}

module.exports = Registrar
