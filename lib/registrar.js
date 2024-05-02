
const assert = require( "assert" )
const events = require( "events" )

const parseuri = require( "drachtio-srf" ).parseUri

const reg = require( "./reg.js" )
const store = require( "./store.js" )

/**
 * 
 * @param { string } uri - takes the form of username@realm
 * @returns { object }
 */
function userrealm( uri ) {
  const parts = uri.split( "@" )
  return { user: parts[ 0 ], realm: parts[ 1 ] }
}

/**
External interface, primary class. Stores and handles a map of domains.
@class
*/
class Registrar {

  /**
  Instantiates the Registrar class.
  @constructor
  @param { object } options - the object extending or overriding the defaults
  */
  constructor( options ) {

    /**
      @typedef {Object} userinfo
      @property {string} secret
      @property {string} display
    */
    /**
      Callback we call for caller to provide user information.
      @callback options.userlookup
      @param {string} username
      @param {string} realm
      @returns {userinfo}
    */

    /**
      @typedef {Object} options
      @property {options.userlookup} userlookup
      @property {object} em - event emitter
      @property {object} srf - Drachtio srf object so we can send options
      @property {number} expires=3600 (S)
      @property {number} minexpires=3600 (S)
      @property {number} staletime=300 (S)
      @property {number} authtimeout=5000 (mS) from sending our authrequired to removal and failing
      @property {number} [optionsping] - (S) interval to send an options packet
      @property {number} [regping] - (S) interval which we us register as a ping - no auth will be done - auth is only done on expires must be less than expires
      @property {boolean} [forcerport] - if set to true then we treat all registration as though the client set rport and send response back to the source rather than the contact
    */

    const defaults = {
      expires: 3600,
      minexpires: 3600,
      staletime: 300,
      authtimeout: 60000
    }

    if( undefined === options.em ) {
      options.em = new events.EventEmitter()
    }

    this.options = {
      ...defaults,
      ...options
    }

    this.options.srf.use( "register", this._reg.bind( this ) )

    this.options.em.on( "presence.voicemail.out", async ( info ) => {
      const entity = userrealm( info.entity )
      await this.notifyvoicemil( info, entity.realm, entity.user )
    } )
  }

  static get store() {
    return store
  }

  /**
   * simplify for the caller
   * @param { object } ev - event emitter 
   * @param { function } cb - event callback
   */
  on( ev, cb ) {
    this.options.em.on( ev, cb )
  }

  /**
  Handles registration:
  - throws an error if the registrar instance has been used more than once
  - invokes next if the request method is not REGISTER
  - parses the req.registration.aor property and calls the _isauthed method to get the registration
  - if the registration is returned, calls reg.onexpire if expired else calls reg.regping and the _sendok method passing the request and response
  - else parses the request To header URI passes to the digest authentication function:
    - an options object containing the host parsed and a passwordLookup callback
    - the request, the response and an onauth callback which:
      - sets the req.registrar.contact, .useragent, .allow and .expires properties
      - calls res.send and returns if the options.regping method is not present and the req.registrar.expires property is non-zero and less than the options.minexpires property
      - adds a new domain instance by realm if not present
      - gets the domain, calls domain.reg and emits the register event with information on the registration
      - deletes the domain if no users are present
      - calls the _sendok method passing the request and response
  @private
  @param { object } req - the incoming request
  @param { object } req.registrar
  @param { string } req.method
  @param { Response } res - the outgoing response
  @param { function } next - a callback
  */
  async _reg( req, res, next ) {

    req.registrar = {}
    if ( "REGISTER" !== req.method ) return next()

    const r = store.get( req )
    if( r ) {
      await r._update( req, res )
      return
    }

    reg.create( req, res, this.options )
  }

  /**
  Gets the names of all domains:
  - returns an array containing the keys of the domains property
  @method
  */
  async realms() {
    return store.realms()
  }

  /**
  Gets all domains:
  - returns a map of domains
  @method
  */
  getalldomains() {
    return store.getalldomains()
  }

  /**
  Gets information on all user registrations for a realm:
  - returns an array containing info from reg.info for all user registrations at a realm if present
  - else returns an empty array
  @method
  @param { string } realm - the name of the domain
  */
  async users( realm ) {
    if ( !store.has( realm ) ) {
      return []
    }
    return store.getdomain( realm ).info()
  }

  /**
   * local object type returned by getdomain
   * @typedef { object } entity
   * @property { string } username
   * @property { string } realm
   * @property { string } uri
   */

  /**
  Gets information on all registrations for a user at a realm:
  - parses the host and username from the realm if the username is not passed
  - returns an array containing info from reg.info for all registrations for the user if present
  - else returns an empty array

  Usage options:
  - user( "bling.babblevoice.com", "1000" )
  - user( "1000@bling.babblevoice.com" )

  Method async for future storage of registrations in Redis or similar.
  @param { string | entity } realm - the name of the domain, or the full address or entity object
  @param { string } username - the name of the user
  */
  async user( realm, username ) {

    if ( undefined === username ) {
      if( "object" === typeof realm ) {
        if( undefined !== realm.username && undefined !== realm.realm ) {
          username = realm.username
          realm = realm.realm
        } else {
          const parsed = parseuri( "sip:" + realm.uri )
          realm = parsed.host
          username = parsed.user
        }
      } else {
        const parsed = parseuri( "sip:" + realm )
        realm = parsed.host
        username = parsed.user
      }
    }

    if ( !store.has( realm ) ) return []

    return store.getdomain( realm ).get( username )
  }

  /**
    @typedef { Object } contacts
    @property { string } username
    @property { string } realm
    @property { string } display
    @property { string } uri
    @property { Array< contact > } contacts
  */

  /**
   * @typedef { Object } contact
   * @property { string } contact
   * @property { object } network
   * @property { string } network.source_address
   * @property { string } network.protocol
   * @property { number } network.source_port
   * @property { boolean } network.rport
   */

  /**
   * Colates all of the contacts for all registrations for a user@domain into a
   * single contact array to ease calling multiple registrations.
   * Identical in usage to user()
   *
   * @param { string | entity } realm - the name of the domain, or the full address or entity object
   * @param { string } username - the name of the user
   * @returns { Promise< contacts > }
   */
  async contacts( realm, username ) {

    let strrealm = ""
    if ( undefined === username ) {
      if( "object" === typeof realm ) {
        if( undefined !== realm.username && undefined !== realm.realm ) {
          username = realm.username
          strrealm = realm.realm
        } else {
          const parsed = parseuri( "sip:" + realm.uri )
          strrealm = parsed.host
          username = parsed.user
        }
      } else {
        const parsed = parseuri( "sip:" + realm )
        strrealm = parsed.host
        username = parsed.user
      }
    } else if( "string" == typeof realm ) strrealm = realm

    const regs = await this.user( strrealm, username )
    if( 0 === regs.length ) {
      return {
        username,
        "realm": strrealm,
        "display": "",
        "uri": username + "@" + strrealm,
        "contacts": []
      }
    }

    const contacts = {
      username,
      "realm": strrealm,
      "display": regs[ 0 ].auth.display,
      "uri": username + "@" + strrealm,
      "contacts": []
    }

    for( const reg of regs ) {
      for( const contact of reg.contacts ) {
        if( !reg.isstale ) {
          contacts.contacts.push( { contact, "network": reg.network } )
        }
      }
    }
    return contacts
  }

  /**
   * Send a notify with the headers.
   * @param { contacts } contacts - array of contacts as provided by the contacts function
   * @param { object } headers - object with item for each header to set
   * @param { string } [ body ] - body if we need to send one
   */
  notify( contacts, headers, body ) {

    const opts = {
      method: "NOTIFY",
      headers
    }

    if( body ) opts.body = body

    for( const contact of contacts.contacts ) {
      this.options.srf.request( contact.contact, opts )
    }
  }

  /**
   * 
   * @param { object } info
   * @param { number } info.new - number of new messages
   * @param { number } info.old - number of old messages
   * @param { number } [ info.newurgent ] - number of new urgent
   * @param { number } [ info.oldurgent ] - number of old urgent
   * @param { string } realm 
   * @param { string } username 
   */
  async notifyvoicemil( info, realm, username ) {

    const contacts = await this.contacts( realm, username )

    const waiting =  0<info.new?"yes":"no"

    if( undefined === info.newurgent ) info.newurgent = 0
    if( undefined === info.oldurgent ) info.oldurgent = 0

    const body = [ `Messages-Waiting: ${waiting}`,
      `Message-Account: sip:${contacts.uri}`,
      `Voice-Message: ${info.new}/${info.old} ${info.newurgent}/${info.oldurgent}` ].join( "\r\n" )

    const headers = {
      "Content-Type": "application/simple-message-summary",
      "Subscription-State": "terminated;reason=noresource",
      "Event": "message-summary",
      "Content-Length": body.length
    }

    this.notify( contacts, headers, body )
  }

  /**
   * Send NOTIFY to the registered endpoint with a (reboot) check notify sync message
   * @param { string } realm - the realm or username (user@realm)
   * @param { string } username - if not included in the realm the username
   */
  async notifychecksync( realm, username ) {

    const headers = {
      "Content-Type": "application/simple-message-summary",
      "Content-Length": 0,
      "Event": "check-sync",
      "Subscription-State": "terminated;reason=noresource"
    }

    this.notify( await this.contacts( realm, username ), headers )

  }
}

module.exports = Registrar
