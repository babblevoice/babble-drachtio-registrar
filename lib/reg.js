
const { v4: uuidv4 } = require( "uuid" )
const sipauth = require( "@babblevoice/babble-drachtio-auth" )
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

    this._created = this._now()
    this._modified = this._now()

    /**
    network details - source.
    @type {object}
    */
    this.network = {}
    this.network.source_address = req.source_address
    this.network.source_port = req.source_port
    this.network.protocol = req.protocol
    this.network.rport = -1 !== req.get( "via" ).indexOf( ";rport=" )

    /**
    @type {string}
    */
    this.useragent = ""
    if( req.has( "User-Agent" ) ) this.useragent = req.get( "User-Agent" )

    /**
    Allow header
    @type {Array.<string>}
    */
    this.allow = []
    this.parseallow( req )

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
    this._auth = sipauth.create( this._options.proxy )
    this._auth.requestauth( req, res )
  }

  static create( req, res, options ) {
    return new reg( req, res, options )
  }

  parseallow( req ) {
    let allw = req.get( "Allow" )
    if( "string" === typeof allw ) {
      this.allow = allw.split( /[\s,]+/ )
    } else {
      const contact = req.getParsedHeader( "Contact" )
      if( contact[ 0 ].params && contact[ 0 ].params.methods ) {
        this.allow = contact[ 0 ].params.methods.split( /[\s,]+/ )
      }
    }
  }

  /**
  When we receive a register for this reg. Private to this module - not class.
  @private
  */
  async _update( req, res ) {

    const wasexpiring = this._expiring
    const wasauthed = this._authed
    const rport = -1 !== req.get( "via" ).indexOf( ";rport=" )

    const contact = req.getParsedHeader( "Contact" )

    /* if the client has requested rport then we modify the contact string. This conforms to RFC 3581 */
    if( contact && rport && "udp" === req.protocol ) {
      contact.forEach( c => {
        const hostport = req.source_address + ":" + req.source_port
        c.uri = c.uri.replace( /(?:\d{1,3}\.){3}\d{1,3}:\d{1,5}/, hostport )
      } )
    }

    const expiresheader = req.get( "Expires" )

    let expires
    if( contact[ 0 ].params && contact[ 0 ].params.expires ) {
      expires = parseInt( contact[ 0 ].params.expires )
    } else if ( typeof expires === 'undefined' && undefined !== expiresheader ) {
      expires = parseInt( expiresheader )
    } else {
      this.destroy()
      return res.send( 400 )
    }

    this._modified = this._now()

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

    /* Unreg */
    this.type = 0 === expires ? 'unregister' : 'register'
    if ( 0 === expires && 
          this.network.source_address === req.source_address &&
          this.network.source_port === req.source_port &&
          this.network.protocol === req.protocol ) {
        
      res.send( 200, {
        headers: {
          Contact: req.get( "Contact" ).replace( /expires=\d+/, `expires=0` ),
          Expires: 0
        }
      } )

      return this._onexpire()
    }

    if( 0 === expires || !wasauthed || wasexpiring ) {

      if( !this._auth.has( req ) ) {
        if( this._timers.regauth ) clearTimeout( this._timers.regauth )
        this._timers.regauth = setTimeout( this._onauthtimeout.bind( this ), this._options.authtimeout )

        this._auth = sipauth.create( this._options.proxy )
        return this._auth.requestauth( req, res )
      }

      this._authorization = this._auth.parseauthheaders( req )
      if( !this._user ) {
        this._user = await this._options.userlookup( this._authorization.username, this._authorization.realm )
        if( !this._user ) {
          this.destroy()
          console.error( "Error looking up user (registrar)" )
          return res.send( 403, "User error" )
        }
        this._user.username = this._authorization.username
        this._user.realm = this._authorization.realm
      } else if( this._user.username != this._authorization.username ||
            this._user.realm != this._authorization.realm ) {
          /* username or realm cannot change in the same reg */
          this.destroy()
          return res.send( 403, "Inconsistent" )
      }

      if( !this._user || !this._auth.verifyauth( req, this._authorization, this._user.secret ) ) {

        if( this._auth.stale ) {
          this._timers.regauth = setTimeout( this._onauthtimeout.bind( this ), this._options.authtimeout )
          return this._auth.requestauth( req, res )
        }

        if( this._options.em ) {
          this._options.em.emit( "register.auth.failed", { "network": this.network } )
        }

        this.destroy()
        return res.send( 403, "Bad auth" )
      }

      if( this._timers.regexpire ) clearTimeout( this._timers.regexpire )
      if( undefined !== this._options.regping ) {
        /* under reg ping the phones expire is reduced and we consider expire to be our longer window */
        expires = this._options.expires
      }

      this._timers.regexpire = setTimeout( this._onexpire.bind( this ), expires * 1000, this )
      this.registeredat = this._now()
      this.expires = expires
    }

    if( this._timers.regauth ) clearTimeout( this._timers.regauth )

    //contact header is required
    if ( !req.get( "Contact" ) || !contact.length ) {
      this.destroy()
      return res.send( 400 )
    }

    this.contact = contact
    this._authed = true

    this.parseallow( req )

    this.network = {}
    this.network.source_address = req.source_address
    this.network.source_port = req.source_port
    this.network.protocol = req.protocol
    this.network.rport = rport

    if( this._timers.regauth ) clearTimeout( this._timers.regauth )
    this._timers.regauth = false

    this.ping = this._now()

    this._sendok( req, res )

    store.set( this )
    if( ( !wasauthed || wasexpiring ) && this._options.em ) {
      this._options.em.emit( "register", this.info() )
    }

    this._initial = false
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

    const headers = {}
    if ( undefined !== this._options.regping ) {
      const contact = req.getParsedHeader( "Contact" )
      if( contact[ 0 ].params && contact[ 0 ].params.expires ) {
        headers.Contact = "<" + contact[ 0 ].uri + ">;expires=" + this._options.regping
      } else {
        headers.Expires = this._options.regping
      }
    } else {
      headers.Expires = this.expires
    }

    res.send( 200, { headers } )
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

    let expires = this.expires
    if( undefined !== this._options.regping ) {
      /* under reg ping the phones expire is reduced and we consider expire to be our longer window */
      expires = this._options.expires
    }

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
      expires: expires,
      registeredat: this.registeredat,
      useragent: this.useragent,
      allow: this.allow,
      network: this.network,
      expiresat: this.registeredat + expires,
      expiresin: this.registeredat + expires - this._now(),
      stale: this.ping < ( this._now() - this._options.staletime ),
      created: this._created,
      modified: this._modified
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
    if( this._timers.options ) clearInterval( this._timers.options )
    if( this._timers.regauth ) clearTimeout( this._timers.regauth )
    if( this._timers.regexpire ) clearTimeout( this._timers.regexpire )
    store.delete( this )

    if( this._options.em && this._authed ) {
      this._options.em.emit( "unregister", this.info() )
    }
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

function rport( contact ) {
  if( contact.network.rport && "udp" === contact.network.protocol ) {
    let hostport = contact.network.source_address + ":" + contact.network.source_port
    newoptions.contact = newoptions.contact.replace( /(?:\d{1,3}\.){3}\d{1,3}:\d{1,5}/, hostport )
  }
}

module.exports = reg
