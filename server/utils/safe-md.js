const marked = require('marked')
const url = require('url')
const renderer = new marked.Renderer()
renderer._image = renderer.image

if(!location) {
  var location = { hostname: process.env.hostname || 'opensprites.org' }
}

const imagewhitelist = [
  'tinypic.com',
  'photobucket.com',
  'cubeupload.com',
  'imageshack.com',
  'imageshack.us',
  'modshare.tk',
  'scratchr.org',
  'wikipedia.org',
  'wikimedia.org',
  'modshare.futuresight.org',
  'scratch.mit.edu',
  'scratch-dach.info',
  'opensprites.org',
  location.hostname
]
renderer.image = function(href, title, text) {
  let hostname = url.parse(href).hostname
  let allowed = false
  for(let item of imagewhitelist) {
    if(hostname.endsWith(item)) {
      allowed = true
      break
    }
  }
  if(allowed) {
    return this._image(href, title, text)
  } else return "[Not an allowed image host: " + hostname + "]"
}

renderer.heading = function (text, level) {
  var escapedText = text.toLowerCase().replace(/[^\w]+/g, '-');

  return '<h' + level + '><a name="' +
                escapedText +
                 '" class="anchor" href="#' +
                 escapedText +
                 '"><span class="header-link"></span></a>' +
                  text + '</h' + level + '>';
}

module.exports = renderer