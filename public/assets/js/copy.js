const Clipboard = require('clipboard/dist/clipboard.min.js')

module.exports = function() {
  if(document.getElementById('copycode')) {
    let cb = new Clipboard('#copycode')
    let int = 0

    let was = document.querySelector('#copycode').innerHTML

    cb.on('success', function(e) {
      document.querySelector('#copycode').innerHTML = 'Copied!'

      window.clearInterval(int)
      int = window.setInterval(() => document.querySelector('#copycode').innerHTML = was, 1000)

      e.clearSelection()
    })

    cb.on('error', function(e) {
      document.querySelector('#copycode').innerHTML = 'Press Ctrl+C to copy'

      window.clearInterval(int)
      int = window.setInterval(() => document.querySelector('#copycode').innerHTML = was, 1000)
    })
  }
}
