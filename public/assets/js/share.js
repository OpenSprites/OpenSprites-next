/**
 * js/share.js
 * -----------
 * 
 * Black magic for the Share page.
 */

const template = require('./template')

module.exports = function() {
  // liam, work your page

  function addResourceInput() {
    const dialog = template('file-upload')
    document.getElementById('file-uploads').appendChild(dialog)
  }

  addResourceInput()

  document.getElementById('add-resource')
    .addEventListener('click', addResourceInput)
}