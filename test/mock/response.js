

class Response {

  constructor() {
    this.messagesent = []
  }

  send( code, options ) {
    this.messagesent.push( {
      "code": code,
      "options": options
    } )
  }

  static create() {
    return new Response()
  }
}

module.exports = Response
