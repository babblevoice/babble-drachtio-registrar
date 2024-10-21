
/**
 * Represents a user. Held by a domain. Stores and handles a map of user registrations.
 */
class user {

  constructor() {
    this._registrations = new Map()
  }

  /**
   * Stores reg against a user:
  -* adds and returns a registration by call ID if not present, or returns if expired
  -* else calls the remove method for a registration and returns
  -* else gets a registration, calls reg.update, returns it
   * @param { object } reg - the registration object
   */
  set( reg ) {
    this._registrations.set( reg.callid, reg )
    return this
  }

  /**
   * Obtain an auth object to be used elsewhere such as INVITE
   * @param { object } authorisation 
   */
  getauth( authorisation ) {
    for( const [ callid, reg ] of this._registrations ) {
      if( reg._auth.equal( authorisation ) ) {
        return reg._auth
      }
    }
  }

  /**
   * Removes a registration:
  -* calls reg.destroy for a registration found by call ID then deletes it
   * @param { object } reg - the registration
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
