module.exports = function detectIE() {
  const ua = window.navigator.userAgent

  const msie = ua.indexOf('MSIE ')
  if(msie > 0) {
    // IE 10 or older => return version number
    return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10)
    document.body.classList.add('ie-old')
  }

  const trident = ua.indexOf('Trident/')
  if(trident > 0) {
    // IE 11 => return version number
    let rv = ua.indexOf('rv:')
    return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10)
    document.body.classList.add('ie-old')
  }

  const edge = ua.indexOf('Edge/')
  if(edge > 0) {
    // Edge (IE 12+) => return version number
    return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10)
  }

  // other browser
  return false
}
