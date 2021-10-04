
const assert = require( "assert" )
const events = require( "events" )

const digestauth = require( "drachtio-mw-digest-auth" )
const registrationparser = require( "drachtio-mw-registration-parser" )
const parseuri = require( "drachtio-srf" ).parseUri

const domain = require( "./domain.js" )

/**
  * External interface, primary class. Stores and handles a map of domains.
  * @class
*/
class Registrar {

  /** */
  constructor( options, regparser = registrationparser ) {

    const defaults = {
      "expires": 3600,
      "minexpires": 3600,
      "staletime": 300,
      "debug": false
    }

    this.options = {
      ...defaults,
      ...options
    }

    this.domains = new Map()

    this.options.srf.use( "register", regparser )
    this.options.srf.use( "register", this.reg )

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
    * Sets an event listener:
    * <br> - sets an event listener on the options.em property for an event and a callback passed
    * @method
    * @param { string } event
    * @param { function } cb - callback
  */
  on( event, cb ) {
    this.options.em.on( event, cb )
  }

  /** */
  reg( req, res, next ) {

    assert( req.registrar === undefined, "Registrar has been used twice" )

    if ( req.method !== "REGISTER" ) return next()

    req.registrar = {}

    let parsedaor = parseuri( req.registration.aor )
    let reg = this._isauthed( parsedaor.host, parsedaor.user, req )

    /* Unreg */
    if ( 0 === req.registration.expires && reg ) {
      reg.onexpire( reg )
    }

    let r = false
    if ( !reg || reg.expiring ) {

      let uri = req.getParsedHeader( "To" ).uri
      this.options.consolelog( `Requesting auth for ${uri}` )

      let toparts = parseuri( uri )

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

      const cb = () => {

        /* User has been authed */
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
              "Contact": req.registrar.contact,
              "Min-Expires": this.options.minexpires
            }
          } )
          return
        }

        if ( !this.domains.has( req.authorization.realm ) ) {
          this.domains.set( req.authorization.realm, new domain( this.options ) )
        }

        let d = this.domains.get( req.authorization.realm )
        r = d.reg( req, this )

        if ( 0 == d.users.size ) {
          this.domains.delete( req.authorization.realm )
        }

        this._sendok( req, res )
        if ( false !== r && undefined !== r ) {
          this.options.em.emit( "register", r.info() )
        }
      }

      digestauth( options )( req, res, cb )

    } else if ( reg ) {
      reg.regping()
      this._sendok( req, res )
    }
  }

  /**
    * Gets a user registration:
    * <br> - returns a registration by realm and username if present
    *        if source address, source port and call ID match
    * <br> - else returns false
    * @method
    * @param { string } realm
    * @param { string } username
    * @param { Request } req
  */
  _isauthed( realm, username, req ) {

    if ( !this.domains.has( realm ) || !this.domains.get( realm ).users.has( username ) ) {
      return false
    }

    let ci = req.get( "call-id" )

    for ( const [ key, reg ] of this.domains.get( realm ).users.get( username ).registrations ) {
      if ( req.source_address === reg.network.source_address &&
        req.source_port === reg.network.source_port &&
        ci === reg.callid ) {
        return reg
      }
    }

    return false
  }

  /** */
  _sendok( req, res ) {

    if ( undefined !== this.options.regping ) {
      res.send( 200, {
        headers: {
          "Contact": req.get( "Contact" ).replace( /expires=\d+/, `expires=${ this.options.regping }` ),
          "Expires": this.options.regping
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
  }

  /**
    * Gets the names of all domains:
    * <br> - returns an array containing the keys of the domains property
    * @method
  */
  realms() {
    return Array.from( this.domains.keys() )
  }

  /**
    * Gets information on all user registrations for a realm:
    * <br> - returns an array containing info from reg.info for all user registrations at a realm
    * or an empty array if no realm
    * @method
    * @param { string } realm
  */
  users( realm ) {
    if ( !this.domains.has( realm ) ) {
      return []
    }
    return this.domains.get( realm ).info()
  }

  /**
    * Gets information on all registrations for a user at a realm:
    * <br> - parses the host and username from the realm if the username is not passed
    * <br> - returns an array containing info from reg.info for all registrations for the user if present
    * <br> - else returns an empty array
    * <br>
    * <br> Usage options
    * <br> a) user("bling.babblevoice.com", "1000")
    * <br> b) user("sip:1000@bling.babblevoice.com")
    * <br>
    * <br> Method async for future storage of registrations in Redis or similar.
    * @method
    * @param { string } realm
    * @param { string } username
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
