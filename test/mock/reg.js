
let callid = 1

class reg {

  constructor( username = "bob" ) {

    this._authorization = {
      "username": username
    }

    this.callid = "somecallid_" + callid
  }

  info() {
    return {}
  }

  static create( domain, username ) {
    callid++
    return new reg( domain, username )
  }
}

module.exports = reg
