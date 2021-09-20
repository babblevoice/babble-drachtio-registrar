class Request {

  static defaultValues = {

    /*
      Request class
      cf. https://drachtio.org/api#sip-message
    */

    cancel: () => {},
    proxy: () => {},
    isNewInvite: true,

    /*
      SipMessage mix-in class, used by the Request and Response classes
      cf. https://drachtio.org/api#sip-message
    */

    get: function( header ) { return this.headers[ header ] },
    getParsedHeader: () => {},
    has: () => {},

    body: "some_body",
    calledNumber: "some_calledNumber",
    callingNumber: "some_callingNumber",
    headers: {},
    method: "some_method",
    payload: [],
    protocol: "some_protocol",
    reason: "some_reason",
    source: "some_source",
    source_address: "some_source_address",
    source_port: "some_source_port",
    stackTime: "some_stackTime",
    stackDialogId: "some_stackDialogId",
    stackTxnId: "some_stackTxnId",
    // status: 200, // Response only
    type: "request",
    uri: "", // Request only

    authorization: {
      username: "some_username"
    },
    registrar: {
      useragent: "some_useragent",
      allow: "some _,allow", // babble-drachtio-registrar reg class constructor splits on \s or ,
      contact: "expires=1",
      expires: 1
    },
    registration: {
      contact: [ { uri: "some_uri" }, { uri: "some_uri" } ],
      aor: "some_aor",
      expires: 1
    },
    headers: {
      "call-id": "some_call-id",
      "Contact": "expires=1"
    }
  }

  static values = Request.defaultValues

  constructor() {

    Object.keys( Request.values ).forEach( key => {
      this[ key ] = Request.values[ key ]
    })
  }

  static update = function( newValues ) {

    const keys = Object.keys( Request.values )

    for( let key in newValues ) {
      if( keys.includes( key ) ) {
        Request.values[ key ] = newValues[ key ]

        if( typeof key === "object" ) Request.update( newValues[ key ] )
      }
    }
  }

  static init = function( initialValues ) {

    Request.update( Request.defaultValues )
    Request.update( initialValues )

    return new Request()
  }
}

module.exports = Request
