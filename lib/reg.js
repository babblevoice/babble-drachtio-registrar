
const { v4: uuidv4 } = require( "uuid" )
const sipauth = require( "babble-drachtio-auth" )
const store = require( "./store.js" )

const domainnamere = /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/

// TODO - review aor and auth in info function
// including test "reg.info returns correct structure"
/**
Represents a registration. Held by a user. Allowed multiple contact fields.
@class
*/
class reg {

  /**
  Instantiates the reg class.
  @constructor
  @param { Request } req - the intial request
  @param { Response } res - srf response
  @param { object } [options]
  */
  constructor( req, res, options = {} ) {

    /**
    Our uuid for this registration - garanteed to be unique.
    */
    this.uuid = uuidv4()
    /**
    Is this the first registration.
    @private
    */
    this._initial = true

    /**
    Have we at authed at any point.
    @private
    */
    this._authed = false

    /**
    Where we store auth info
    @private
    */
    this._authorization = false

    /**
    network details - source.
    @type {object}
    */
    this.network = {}
    this.network.source_address = req.source_address
    this.network.source_port = req.source_port
    this.network.protocol = req.protocol

    /**
    @type {string}
    */
    this.useragent = ""
    if( req.has( "User-Agent" ) ) this.useragent = req.get( "User-Agent" )

    let allw = req.get( "Allow" )
    /**
    Allow header
    @type {Array.<string>}
    */
    this.allow = []
    if( "string" === typeof allw ) {
      this.allow = allw.split( /[\s,]+/ )
    }

    this.callid = req.get( "call-id" )

    /**
     fq = fully qualified call id
     @private
    */
    this._fqcallid = this.callid + "@" + this.network.source_address + ":" + this.network.source_port

    /**
    @private
    */
    this._options = options

    /**
    @private
    */
    this._user = false

    this.contact = []

    this.expires = 3600
    if ( undefined !== options.expires ) {
      this.expires = options.expires
    }

    this.registeredat = this._now()
    this.ping = this._now()

    /**
    @private
    */
    this._timers = {
      "regexpire": false,
      "regauth": setTimeout( this._onauthtimeout.bind( this ), this._options.authtimeout ),
      "options": false
    }

    if ( undefined !== options.optionsping ) {
      this._timers.options = setInterval( this._pingoptions.bind( this ), options.optionsping * 1000 )
    }

    store.set( this )

    /* All registrations are authed */
    this._auth = new sipauth.auth()
    this._auth.requestauth( req, res )
  }

  static create( req, res, options ) {
    return new reg( req, res, options )
  }

  /**
  When we receive a register for this reg. Private to this module - not class.
  @private
  */
  async _update( req, res ) {

    let wasexpiring = this._expiring
    let wasauthed = this._authed

    if( !wasauthed || wasexpiring || this._auth.has( req ) ) {

      if( !this._auth.has( req ) ) {
        if( this._timers.regauth ) clearTimeout( this._timers.regauth )
        this._timers.regauth = setTimeout( this._onauthtimeout.bind( this ), this._options.authtimeout )

        this._auth = new sipauth.auth()
        return this._auth.requestauth( req, res )
      }

      this._authorization = this._auth.parseauthheaders( req, res )
      if( !this._user ) {
        this._user = await this._options.userlookup( this._authorization.username, this._authorization.realm )
        this._user.username = this._authorization.username
        this._user.realm = this._authorization.realm
      } else if( this._user.username != this._authorization.username ||
            this._user.realm != this._authorization.realm ) {
          /* username or realm cannot change in the same reg */
          this.destroy()
          return res.send( 403 )
      }

      if( !this._user || !this._auth.verifyauth( req, this._authorization, this._user.secret ) ) {

        if( this._auth.stale ) {
          this._timers.regauth = setTimeout( this._onauthtimeout.bind( this ), this._options.authtimeout )
          return this._auth.requestauth( req, res )
        }

        this.destroy()
        return res.send( 403 )
      }
    }

    if( this._timers.regauth ) clearTimeout( this._timers.regauth )

    const contact = req.getParsedHeader( "Contact" )
    const to = req.getParsedHeader( "To" )
    const expiresheader = req.get( "Expires" )

    //contact header is required
    if ( !req.get( "Contact" ) || !contact.length ) {
      this.destroy()
      return res.send( 400 )
    }

    let expires
    if( contact[ 0 ].params && contact[ 0 ].params.expires ) {
      expires = parseInt( contact[ 0 ].params.expires )
    } else if ( typeof expires === 'undefined' && undefined !== expiresheader ) {
      expires = parseInt( expiresheader )
    } else {
      this.destroy()
      return res.send( 400 )
    }

    if ( undefined === this._options.regping &&
          undefined !== this._options.minexpires &&
          expires < this._options.minexpires &&
          0 !== expires ) {

      res.send( 423, {
        /* Interval too brief - can we pass this in as a config item? */
        headers: {
          Contact: contact,
          "Min-Expires": this._options.minexpires
        }
      } )
      return
    }

    this.type = 0 === expires ? 'unregister' : 'register'
    this.expires = expires
    this.contact = contact

    this._authed = true

    /* Unreg */
    if ( 0 === this.expires ) {
      return this._onexpire()
    }

    if( this._timers.regauth ) clearTimeout( this._timers.regauth )
    this._timers.regauth = false

    if( this._timers.regexpire ) clearTimeout( this._timers.regexpire )
    this._timers.regexpire = setTimeout( this._onexpire.bind( this ), this.expires * 1000, this )

    this.registeredat = this._now()
    this._initial = false

    this.ping = this._now()

    this._sendok( req, res )

    store.set( this )

    if( ( !wasauthed || wasexpiring ) && this._options.em ) {
      this._options.em.emit( "register", this.info() )
    }
  }

  /**
  We have requested auth - but no response.
  @private
  */
  _onauthtimeout() {
    this.destroy()
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
    if ( undefined !== this._options.regping ) {
      res.send( 200, {
        headers: {
          Contact: req.get( "Contact" ).replace( /expires=\d+/, `expires=${ this._options.regping }` ),
          Expires: this._options.regping
        }
      } )
    } else {
      res.send( 200, {
        headers: {
          Contact: this.contact,
          Expires: this.expires
        }
      } )
    }
  }

  /**
  Whether the registration has expired.
  @type { boolean }
  */
  get expired() {
    return ( this.registeredat + this.expires ) < this._now()
  }

  /**
  Whether the registration is at least halfway to expiry.
  @type { boolean }
  @private
  */
  get _expiring() {
    return ( this.registeredat + ( this.expires / 2 ) ) < this._now()
  }

  /**
  Gets the current time:
  - returns the current time in seconds
  @method
  */
  _now() {
    return Math.floor( +new Date() / 1000 )
  }

  /**
  Gets information on the registration:
  - populates an array with the URI property of each item on the contact property
  - returns an object containing the newly populated array of contact URIs, selected registration properties and an expiresat, an expiresin and a stale value generated using other properties
  @method
  */
  info() {
    const contacts = []
    this.contact.forEach( ( c ) => {
      contacts.push( c.uri )
    } )

    return {
      uuid: this.uuid,
      initial: this._initial,
      callid: this.callid,
      contacts,
      auth: {
        username: this._authorization.username,
        realm: this._authorization.realm,
        uri: this._authorization.username + "@" + this._authorization.realm,
        display: this._user.display
      },
      expires: this.expires,
      registeredat: this.registeredat,
      useragent: this.useragent,
      allow: this.allow,
      network: this.network,
      expiresat: this.registeredat + this.expires,
      expiresin: this.registeredat + this.expires - this._now(),
      stale: this.ping < ( this._now() - this._options.staletime )
    }
  }

  /**
  Begins unregistration:
  - calls the user remove method for the registration
  */
  _onexpire() {
    this.destroy()
  }

  /**
  Ends unregistration:
  - emits the unregister event with information on the registration
  - clears the optionsintervaltimer interval and regexpiretimer timeout
  */
  destroy() {
    if( this._options.em && this._authed ) {
      this._options.em.emit( "unregister", this.info() )
    }

    if( this._timers.options ) clearInterval( this._timers.options )
    if( this._timers.regauth ) clearTimeout( this._timers.regauth )
    if( this._timers.regexpire ) clearTimeout( this._timers.regexpire )
    store.delete( this )
  }

  /**
  Sends an OPTIONS ping:
  - call the options SRF request method for each contact passing the contact URI, an options object and a callback, records the ping
  @private
  */
  _pingoptions() {

    const options = {
      method: "OPTIONS",
      headers: {
        Subject: "OPTIONS Ping"
      }
    }

    const handlerequest = ( err, req ) => {
      if ( err ) {
        console.error( err )
        return
      }
      req.on( "response", ( res ) => {
        if ( 200 == res.status ) {
          this.ping = this._now()
        }
      } )
    }

    this.contact.forEach( c => {
      this._options.srf.request( c.uri, options, handlerequest )
    } )
  }
}

module.exports = reg
