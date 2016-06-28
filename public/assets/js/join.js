/**
 * js/join.js
 * ----------
 * 
 * For /join only.
 */

const Clipboard = require('clipboard/dist/clipboard.min.js')

module.exports = function() {
  let cb = new Clipboard('#copycode')
  let int = 0

  cb.on('success', function(e) {
    document.querySelector('#copycode').innerHTML = 'Copied!'

    window.clearInterval(int)
    int = window.setInterval(() => document.querySelector('#copycode').innerHTML = 'Copy', 1000)

    e.clearSelection()
  })

  cb.on('error', function(e) {
    document.querySelector('#copycode').innerHTML = 'Press Ctrl+C to copy'

    window.clearInterval(int)
    int = window.setInterval(() => document.querySelector('#copycode').innerHTML = 'Copy', 1000)
  })
}