class Request {

  constructor( defaultvalues ) {
    this.isNewInvite = true

    /*
      SipMessage mix-in class, used by the Request and Response classes
      cf. https://drachtio.org/api#sip-message
    */
    this.body = "some_body"
    this.calledNumber = "some_calledNumber"
    this.callingNumber = "some_callingNumber"
    this.headers = {}
    this.method = "REGISTER"
    this.payload = []
    this.protocol = "some_protocol"
    this.reason = "some_reason"
    this.source = "some_source"
    this.source_address = "some_source_address"
    this.source_port = 5060
    this.stackTime = "some_stackTime"
    this.stackDialogId = "some_stackDialogId"
    this.stackTxnId = "some_stackTxnId"
    // status: 200, // Response only
    this.type = "request"
    this.uri = "sip:dummy.com;transport=UDP" // Request only
    this.msg = {
      uri: "sip:dummy.com;transport=UDP",
      method: "REGISTER"
    }
    this.authorization = {
      realm: "some.realm",
      username: "1000"
    }
    this.headers = {
      "allow": "some_allow",
      "call-id": "some_call-id",
      "contact": "<sip:1000@192.168.0.141:59095;rinstance=35a53d8fb715f5dc;transport=UDP>",
      "to": "<sip:1000@dummy.com;transport=UDP>",
      "from": "<sip:1000@dummy.com;transport=UDP>;tag=d9e2de25",
      "user-agent": "some_useragent",
      "via": "SIP/2.0/UDP 127.0.0.1:39313;branch=z9hG4bK-524287-1---daa70e79328bdffc;rport=37435"
    }
    this._parsedheaders = {
      "contact": [ {
              "name": undefined,
              "uri": 'sip:1000@192.168.0.141:59095;rinstance=302da93c3a2ae72b;transport=UDP',
              "params": {}
          }
        ],
        "to": {
            "name": undefined,
            "uri": "sip:1000@dummy.com;transport=UDP",
            "params": {}
        },
        "from": {
            "name": undefined,
            "uri": "sip:1000@dummy.com;transport=UDP",
            "params": { tag: "6354b92a" }
        }
    }
  }

  static create() {
    return new Request()
  }

  cancel() {}
  proxy() {}

  set( header, value ) { this.headers[ header.toLowerCase() ] = value }
  get( header ) { return this.headers[ header.toLowerCase() ] }
  getParsedHeader( header ) { return this._parsedheaders[ header.toLowerCase() ] }
  has( header ) { return header.toLowerCase() in this.headers }
  _setparsedheader( header, value ) { this._parsedheaders[ header.toLowerCase() ] = value }
}

module.exports = Request
