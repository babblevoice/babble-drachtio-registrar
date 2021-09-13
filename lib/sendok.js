const { getSingleton } = require( "./singleton.js" )


function sendok( req, res ) {

  const singleton = getSingleton()

  if ( undefined !== singleton.options.regping ) {
    res.send( 200, {
      headers: {
        "Contact": req.get( "Contact" ).replace( /expires=\d+/, `expires=${singleton.options.regping}` ),
        "Expires": singleton.options.regping
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
