
const { v4: uuidv4 } = require( "uuid" )
const sipauth = require( "@babblevoice/babble-drachtio-auth" )
const store = require( "./store" )


/**
 * Represents a registration. Held by a user. Allowed multiple contact fields.
 * TODO - review aor and auth in info function
 * including test "reg.info returns correct structure"
 */
class reg {

  /**
   * @param { object } req - the intial request
   * @param { object } res - srf response
   * @param { object } [ options ]
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
    const via = req.get( "via" )
    let ind  = -1
    if( via && via.indexOf ) ind = via.indexOf( ";rport=" )
    this.network.rport = -1 !== ind
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
    this.#parseallow( req )

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
    this.defaultexpires = 3600
    if ( undefined !== options.expires ) {
      this.expires = options.expires
      this.defaultexpires = options.expires
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

    this.regping = this._options.regping
    this.minexpires = this._options.minexpires

    if( this._auth.has( req ) ) {
      this._auth.stale = true
    }

    this._auth.requestauth( req, res )
    this._timers.regauth = setTimeout( () => this._onauthtimeout(), this._options.authtimeout )

    if( this._options.prereg ) this._options.prereg( this )
  }

  /**
   * 
   * @param { object } req 
   * @param { object } res 
   * @param { object } [ options ]
   * @returns 
   */
  static create( req, res, options ) {
    return new reg( req, res, options )
  }

  /**
   * 
   * @param { object } req 
   * @returns 
   */
  #parseallowfromcontact( req ) {
    /* well this would be bad */
    if( !req.has( "Contact" ) ) return

    const contact = req.getParsedHeader( "Contact" )
    if( !contact ) return
    if( contact[ 0 ].params && contact[ 0 ].params.methods ) {
      let methods = contact[ 0 ].params && contact[ 0 ].params.methods
      methods = methods.replace( /"/g, "" )
      this.allow = methods.split( /[\s,]+/ )
    }
  }

  /**
   * 
   * @param { object } req 
   */
  #parseallow( req ) {
    if( !req.has( "allow" ) ) return this.#parseallowfromcontact( req )

    let allw = req.get( "Allow" )
    if( "string" !== typeof allw ) return

    allw = allw.trim()
    allw = allw.replace( /"/g, "" )
    this.allow = allw.split( /[\s,]+/ )
  }

  /**
   * 
   * @param { object } req 
   * @param { Array< object > } contact 
   * @returns { number | NaN }
   */
  #getexpires( req, contact ) {

    if( Array.isArray( contact ) && contact[ 0 ].params && contact[ 0 ].params.expires ) {
      const expires = parseInt( contact[ 0 ].params.expires )
      if( !Number.isNaN( expires ) ) return expires
    }

    if( !req.has( "Expires" ) ) return NaN
    const expiresheader = req.get( "Expires" )
    return parseInt( expiresheader )
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

    if ( 0 !== expires )  return false

    const expreg = /expires=\d+/
    const contact = req.get( "Contact" )
    const headers = {}

    if( -1 !== contact.search( expreg ) ) {
      headers.Contact = req.get( "Contact" ).replace( expreg, "expires=0" )
    } else {
      headers.Expires = 0
      headers.Contact = contact
    }

    res.send( 200, { headers } )

    this.destroy()
    return true

  }

  /**
   * 
   * @param { object } res 
   * @param { number } expires 
   * @param { Array< object > } contact 
   * @returns 
   */
  #istoobrief( res , expires, contact ) {
    if( undefined !== this.regping ) return false
    if( undefined === this.minexpires ) return false
    if( expires >= this.minexpires ) return false
    if( 0 === expires ) return false 

    /* Interval too brief - can we pass this in as a config item? */
    res.send( 423, { headers: {
      "Contact": contact,
      "Min-Expires": this.minexpires
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
      this._timers.regauth = setTimeout( () => this._onauthtimeout(), this._options.authtimeout )

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
        this.destroy()
        return false
      }
      this._user.username = this._authorization.username
      this._user.realm = this._authorization.realm
    } else if( this._user.username != this._authorization.username ||
          this._user.realm != this._authorization.realm ) {
      /* username or realm cannot change in the same reg */
      res.send( 403, "Inconsistent" )
      this.destroy()
      return false
    }

    if( !this._auth.verifyauth( req, this._authorization, this._user.secret ) ) {
      if( this._auth.stale ) {
        clearTimeout( this._timers.regauth )
        this._timers.regauth = setTimeout( () => this._onauthtimeout(), this._options.authtimeout )
        this._auth.requestauth( req, res )
        return false
      }

      if( this._options.em ) {
        this._options.em.emit( "register.auth.failed", { "network": this.network } )
      }

      res.send( 403, "Bad auth" )
      this.destroy()
      return false
    }

    clearTimeout( this._timers.regauth )
    delete this._timers.regauth
    return true
  }

  /**
   * 
   * @param { object } res 
   */
  failureanddestroy( res ) {
    res.send( 400 )
    this.destroy()
  }

  /**
   * When we receive a register for this reg. Private to this module - not class.
   * @param { object } req
   * @param { object } res
   * @private
   **/
  async _update( req, res ) {
    const wasexpiring = this._expiring
    const rport = -1 !== req.get( "via" ).indexOf( ";rport=" )

    /* contact header is required */
    if ( !req.has( "Contact" ) ) return this.failureanddestroy( res )

    const contact = req.getParsedHeader( "Contact" )
    if( !contact.length ) return this.failureanddestroy( res )

    let expires = this.#getexpires( req, contact )
    if( isNaN( expires ) ) return this.failureanddestroy( res )

    if( this.#istoobrief( res, expires, contact ) ) return
    if( !(await this.#requestauth( req, res ) ) ) return
    this._modified = this._now()

    /* The request has been authorized */
    /* Unreg */
    if( this.#handleunreg( req, res, expires ) ) return

    if( undefined !== this.regping ) {
      /* under reg ping we ask the uac to register at regping interval
      (shorter than expires) and the expires value is when we clean up 
      - which can be slightly longer to allow for some network troubles */
      expires = this.defaultexpires
    }

    clearTimeout( this._timers.regexpire )
    this._timers.regexpire = setTimeout( () => this.destroy(), 1000 * expires )
    this.expires = expires

    clearTimeout( this._timers.regauth )
    delete this._timers.regauth

    this.contact = contact
    this._authed = true

    this.#parseallow( req )

    this.network = {}
    this.network.source_address = req.source_address
    this.network.source_port = req.source_port
    this.network.protocol = req.protocol
    this.network.rport = rport
    this.#doforcerport()

    this.contact.forEach( c => {
      c.uri = this._rport( c.uri )
      c.uri = this._transport( c.uri )
    } )

    this.ping = this._now()

    this.#getuseragent( req )

    this.#sendok( req, res )

    this.#configureping()

    store.set( this )
    this.#emitregister( wasexpiring )

    this._initial = false
  }

  /**
   * 
   */
  #doforcerport() {
    if( this._options && this._options.forcerport ) this.network.rport = true
  }

  /**
   * 
   * @param { object } req 
   */
  #getuseragent( req ) {
    if( req.has( "User-Agent" ) ) this.useragent = req.get( "User-Agent" )
    if( "noop" === this.useragent ) throw new Error( "No operation" )
  }

  /**
   * 
   */
  #configureping() {
    if ( undefined !== this._options.optionsping ) {
      this._timers.options = setInterval( () => this._pingoptions(), this._options.optionsping * 1000 )
    }
  }

  /**
   * 
   * @param { boolean } wasexpiring 
   */
  #emitregister( wasexpiring ) {
    if( ( this._initial || wasexpiring ) && this._options.em ) {
      this.registeredat = this._now()
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
   * Sends a success response:
   * - sets headers using the request Contact header and options regping property if the latter is present
   * - else sets headers using the request registrar contact and expires properties
   * @method
   * @param { object } req - the incoming request
   * @param { object } res - the outgoing response
   */
  #sendok( req, res ) {

    if( !req.has( "Contact" ) ) return
    const contact = req.getParsedHeader( "Contact" )

    const headers = {}
    if ( undefined !== this.regping ) {
      if( contact[ 0 ].params && contact[ 0 ].params.expires ) {
        headers.Contact = "<" + contact[ 0 ].uri + ">;expires=" + this.regping
      } else {
        headers.Expires = this.regping
        headers.Contact = contact[ 0 ].uri
      }
    } else {
      headers.Expires = this.expires
      headers.Contact = contact[ 0 ].uri
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
    if( undefined !== this.regping ) {
      /* under reg ping the phones expire is reduced and we consider expire to be our longer window */
      this._expires = this.defaultexpires
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

  /**
   * 
   * @param { string } uri 
   * @returns { string }
   */
  _transport( uri ) {
    if( -1 === uri.indexOf( "transport=" )) {
      return uri += ";transport=" + this.network.protocol
    }
    return uri
  }
}

module.exports = reg
