
const { v4: uuidv4 } = require( "uuid" )
const sipauth = require( "@babblevoice/babble-drachtio-auth" )
const store = require( "./store.js" )


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
  @param { object } req - the intial request
  @param { object } res - srf response
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
    this._authorization

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
    if( options && options.forcerport ) this.network.rport = true

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
    this._user

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
    this._timers = {}

    store.set( this )

    /* All registrations are authed */
    this._auth = sipauth.create( this._options.proxy )

    if( this._auth.has( req ) ) {
      this._auth.stale = true
    }

    this._auth.requestauth( req, res )
  }

  static create( req, res, options ) {
    return new reg( req, res, options )
  }

  /**
   * 
   * @param { object } req 
   */
  parseallow( req ) {
    let allw = req.get( "Allow" )
    if( "string" === typeof allw ) {
      allw = allw.trim()
      allw = allw.replace( /"/g, "" )
      this.allow = allw.split( /[\s,]+/ )
    } else {
      const contact = req.getParsedHeader( "Contact" )
      if( !contact ) return
      if( contact[ 0 ].params && contact[ 0 ].params.methods ) {
        let methods = contact[ 0 ].params && contact[ 0 ].params.methods
        methods = methods.replace( /"/g, "" )
        this.allow = methods.split( /[\s,]+/ )
      }
    }
  }

  /**
   * 
   * @param { object } req 
   * @param { Array< object > } contact 
   * @returns { number | NaN }
   */
  #getexpires( req, contact ) {

    const expiresheader = req.get( "Expires" )
    let expires
    if( contact[ 0 ].params && contact[ 0 ].params.expires ) {
      expires = parseInt( contact[ 0 ].params.expires )
    } else if ( "undefined" === typeof expires && undefined !== expiresheader ) {
      expires = parseInt( expiresheader )
    } else {
      return NaN
    }

    return expires
  }

  /**
   * 
   * @param { object } req 
   * @param { object } res 
   * @param { number } expires
   * @returns 
   */
  #handleunreg( req, res, expires ) {
    this.type = 0 === expires ? "unregister" : "register"

    if ( 0 === expires ) {

      const expreg = /expires=\d+/
      const contact = req.get( "Contact" )
      let headers = {}

      if( -1 !== contact.search( expreg ) ) {
        headers.Contact = req.get( "Contact" ).replace( expreg, `expires=0` )
      } else {
        headers.Expires = 0
      }

      res.send( 200, { headers } )

      this.destroy()
      return true
    }
    return false
  }

  /**
   * 
   * @param { object } res 
   * @param { number } expires 
   * @param { Array< object > } contact 
   * @returns 
   */
  #istoobrief( res , expires, contact ) {
    if( undefined !== this._options.regping ) return false
    if( undefined === this._options.minexpires ) return false
    if( expires >= this._options.minexpires ) return false
    if( 0 === expires ) return false 

    /* Interval too brief - can we pass this in as a config item? */
    res.send( 423, { headers: {
                        "Contact": contact,
                        "Min-Expires": this._options.minexpires
                      }
                    } )
    return true

  }

  /**
   * 
   * @param { object } req 
   * @param { object } res 
   * @returns boolean
   */
  async #requestauth( req, res ) {

    if( !this._auth.has( req ) ) {
      clearTimeout( this._timers.regauth )
      this._timers.regauth = setTimeout( this._onauthtimeout.bind( this ), this._options.authtimeout )

      this._auth = sipauth.create( this._options.proxy )
      this._auth.requestauth( req, res )
      return false
    }

    this._authorization = this._auth.parseauthheaders( req )
    if( !this._user ) {
      this._user = await this._options.userlookup( this._authorization.username, this._authorization.realm )
      if( !this._user ) {
        console.error( "Error looking up user (registrar)" )
        res.send( 403, "User error" )
        return false
      }
      this._user.username = this._authorization.username
      this._user.realm = this._authorization.realm
    } else if( this._user.username != this._authorization.username ||
          this._user.realm != this._authorization.realm ) {
        /* username or realm cannot change in the same reg */
        res.send( 403, "Inconsistent" )
        return false
    }

    if( !this._auth.verifyauth( req, this._authorization, this._user.secret ) ) {
      if( this._auth.stale ) {
        clearTimeout( this._timers.regauth )
        this._timers.regauth = setTimeout( this._onauthtimeout.bind( this ), this._options.authtimeout )
        this._auth.requestauth( req, res )
        return false
      }

      if( this._options.em ) {
        this._options.em.emit( "register.auth.failed", { "network": this.network } )
      }

      res.send( 403, "Bad auth" )
      return false
    }

    clearTimeout( this._timers.regauth )
    delete this._timers.regauth
    return true
  }

  /**
  When we receive a register for this reg. Private to this module - not class.
  @private
  */
  async _update( req, res ) {
    const wasexpiring = this._expiring
    const rport = -1 !== req.get( "via" ).indexOf( ";rport=" )

    //contact header is required
    if ( !req.has( "Contact" ) ) {
      res.send( 400 )
      return
    }
    const contact = req.getParsedHeader( "Contact" )
    if( !contact.length ) {
      res.send( 400 )
      return
    }

    let expires = this.#getexpires( req, contact )
    if( isNaN( expires ) ) {
      res.send( 400 )
      return
    }

    if( this.#istoobrief( res, expires, contact ) ) return
    if( !(await this.#requestauth( req, res ) ) ) return
    this._modified = this._now()

    /* The request has been authorized */
    /* Unreg */
    if( this.#handleunreg( req, res, expires ) ) return

    if( undefined !== this._options.regping ) {
      /* under reg ping the phones expire is reduced and we consider expire to be our longer window */
      expires = this._options.expires
    }

    clearTimeout( this._timers.regexpire )
    this._timers.regexpire = setTimeout( this.destroy.bind( this ), 1000 * expires, this )
    this.expires = expires


    if( this._timers.regauth ) clearTimeout( this._timers.regauth )

    this.contact = contact
    this._authed = true

    this.parseallow( req )

    this.network = {}
    this.network.source_address = req.source_address
    this.network.source_port = req.source_port
    this.network.protocol = req.protocol
    this.network.rport = rport
    if( this._options && this._options.forcerport ) this.network.rport = true

    this.contact.forEach( c => {
      c.uri = this._rport( c.uri )
      c.uri = this._transport( c.uri )
    } )

    if( this._timers.regauth ) clearTimeout( this._timers.regauth )
    this._timers.regauth = false

    this.ping = this._now()

    this._sendok( req, res )

    if ( undefined !== this._options.optionsping ) {
      this._timers.options = setInterval( this._pingoptions.bind( this ), this._options.optionsping * 1000 )
    }

    store.set( this )
    if( ( this._initial || wasexpiring ) && this._options.em ) {
      this.registeredat = this._now()
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
  @param { object } req - the incoming request
  @param { object } res - the outgoing response
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
  * Gets information on the registration:
  *-populates an array with the URI property of each item on the contact property
  *-returns an object containing the newly populated array of contact URIs, selected registration properties and an expiresat, an expiresin and a stale value generated using other properties
  * @return { object }
  */
  info() {
    const contacts = []
    this.contact.forEach( ( c ) => {
      contacts.push( c.uri )
    } )

    this._expires = this.expires
    if( undefined !== this._options.regping ) {
      /* under reg ping the phones expire is reduced and we consider expire to be our longer window */
      this._expires = this._options.expires
    }

    const reginfo = {
      uuid: this.uuid,
      initial: this._initial,
      callid: this.callid,
      contacts,
      expires: this._expires,
      registeredat: this.registeredat,
      useragent: this.useragent,
      allow: this.allow,
      network: this.network,
      expiresat: this.expiresat,
      expiresin: this.expiresin,
      stale: this.isstale,
      created: this._created,
      modified: this._modified
    }

    if( this._authorization ) {
      reginfo.auth = {
        username: this._authorization.username,
        realm: this._authorization.realm,
        uri: this._authorization.username + "@" + this._authorization.realm,
        display: ""
      }

      if( this._user ) reginfo.auth.display = this._user.display
    }

    return reginfo
  }

  get expiresin() {
    return this.registeredat + this._expires - this._now()
  }

  get expiresat() {
    return this.registeredat + this._expires
  }

  get isstale() {
    return this.ping < ( this._now() - this._options.staletime )
  }

  /**
  * Ends unregistration:
  * emits the unregister event with information on the registration
  * clears the optionsintervaltimer interval and regexpiretimer timeout
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
  * Sends an OPTIONS ping:
  * call the options SRF request method for each contact passing the contact URI, an options object and a callback, records the ping
  * @private
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

  /**
   * @param { string } uri
   * @return { string } - uri
   * if the client has requested rport then we modify the contact string. This conforms to RFC 3581 
   */
  _rport( uri ) {
    if( this.network.rport ) {
      const hostport = this.network.source_address + ":" + this.network.source_port
      return uri.replace( /(?:\d{1,3}\.){3}\d{1,3}(:\d{1,5})?/, hostport )
    }
    return uri
  }

  _transport( uri ) {
    // contact += ";transport=tcp" - ony add if you don't have it already
    if( "udp" !== this.network.protocol && -1 === uri.indexOf( "transport=" )) {
      return uri += ";transport=" + this.network.protocol
    }
    return uri
  }
}

module.exports = reg
