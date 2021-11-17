
const reg = require( "./reg.js" )

/**
Represents a user. Held by a domain. Stores and handles a map of user registrations.
@class
*/
class user {

  /**
  Instantiates the user class.
  @constructor
  */
  constructor() {
    this._registrations = new Map()
  }

  /**
  Stores reg against a user:
  - adds and returns a registration by call ID if not present, or returns if expired
  - else calls the remove method for a registration and returns
  - else gets a registration, calls reg.update, returns it
  @method
  @param { reg } reg - the registration object
  */
  set( reg ) {
    this._registrations.set( reg.callid, reg )
    return this
  }

  /**
  Removes a registration:
  - calls reg.destroy for a registration found by call ID then deletes it
  @method
  @param { string } ci - the registration call ID
  */
  delete( reg ) {
    this._registrations.delete( reg.callid )
    return this
  }

  static create() {
    return new user()
  }
}

module.exports = user
