
const { v4: uuidv4 } = require( "uuid" )

/**
  * Represents a registration. Held by a user. Allowed multiple contact fields.
  * @class
*/
class reg {

  /**
   * Instantiates the reg class.
   * @constructor
   * @param { Request } req - the incoming request
   * @param { user } user - the user instance
   */
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

    this.user = user
    this.authorization = user.authorization
    this.options = user.options

    if ( undefined !== user.options.regping ) {
      this.expires = user.options.expires
    }
    this.registeredat = this._now()
    this.ping = this._now()

    if ( undefined !== user.options.optionsping ) {
      this.optionsintervaltimer = setInterval( this.pingoptions.bind( this ), user.options.optionsping * 1000 )
    }

    this.regexpiretimer = setTimeout( this.onexpire.bind( this ), this.expires * 1000 )
  }

  /**
   * Whether the registration has expired
   * @type { boolean }
   */
  get expired() {
    return ( this.registeredat + this.expires ) < this._now()
  }

  /**
   * Whether the registration is at least halfway to expiry
   * @type { boolean }
   */
  get expiring() {
    return ( this.registeredat + ( this.expires / 2 ) ) < this._now()
  }

  /**
   * Gets the current time:
   * <br> - returns the current time in seconds
   * @method
   */
  _now() {
    return Math.floor( +new Date() / 1000 )
  }

  /**
   * Gets information on the registration:
   * <br> - populates an array with the URI property of each item on the contact property
   * <br> - returns an object containing the newly populated array of contact URIs,
   * <br>   selected registration properties and
   * <br>   an expiresat, an expiresin and a stale value generated using other properties
   * @method
   */
  info() {
    const contacts = []
    this.contact.forEach( ( c ) => {
      contacts.push( c.uri )
    } )

    return {
      uuid: this.uuid,
      initial: this.initial,
      callid: this.callid,
      contacts,
      aor: this.aor,
      expires: this.expires,
      authorization: this.authorization,
      registeredat: this.registeredat,
      useragent: this.useragent,
      allow: this.allow,
      network: this.network,
      expiresat: this.registeredat + this.expires,
      expiresin: this.registeredat + this.expires - this._now(),
      stale: this.ping < ( this._now() - this.options.staletime )
    }
  }

  /**
   * Extends the registration:
   * <br> - clears and resets the regexpiretimer timeout
   * <br> - sets the registeredat property to the current time in seconds
   * <br> - sets the initial property to false
   * <br>
   * <br> Called by the framework on further packets.
   * @method
  */
  update() {
    clearTimeout( this.regexpiretimer )
    this.regexpiretimer = setTimeout( this.onexpire, this.expires * 1000, this )
    this.registeredat = this._now()
    this.initial = false
  }

  /**
   * Records a ping:
   * <br> - sets the ping property to the return value of the _now method
   * <br>
   * <br> Called when a register is received, which is used in place of options ping.
  * @method
   */
  regping() {
    this.ping = this._now()
  }

  /**
   * Begins ending the registration:
   * <br> - ...
   * @method
   */
  onexpire() {
    const ci = this.callid
    this.user.remove( ci )
  }

  /**
   * Ends the registration:
   * <br> - ...
   * @method
   */
  destroy() {
    this.options.em.emit( "unregister", this.info( this.options ) )
    clearInterval( this.optionsintervaltimer )
    clearTimeout( this.regexpiretimer )
  }

  /**
   * Sends an OPTIONS ping:
   * <br> - call the options SRF request method for each contact
   * <br>   passing the contact URI, an options object and a callback,
   * <br>   which calls the options.consolelog method with an error or records the ping
   * @method
   */
  pingoptions() {

    const options = {
      method: "OPTIONS",
      headers: {
        Subject: "OPTIONS Ping"
      }
    }

    const handlerequest = ( err, req ) => {
      if ( err ) {
        this.options.consolelog( `Error sending OPTIONS: ${ err }` )
        return
      }
      req.on( "response", ( res ) => {
        if ( 200 == res.status ) {
          this.ping = this._now()
        }
      } )
    }

    this.contact.forEach( c => {
      this.options.srf.request( c.uri, options, handlerequest )
    } )
  }
}

module.exports = reg
