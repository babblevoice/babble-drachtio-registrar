function sendok( req, res, options ) {

  if ( undefined !== options.regping ) {
    res.send( 200, {
      headers: {
        "Contact": req.get( "Contact" ).replace( /expires=\d+/, `expires=${options.regping}` ),
        "Expires": options.regping
      }
    } )
  } else {
    res.send( 200, {
      headers: {
        "Contact": req.registrar.contact,
        "Expires": req.registrar.expires
      }
    } )
  }
}

module.exports = sendok
