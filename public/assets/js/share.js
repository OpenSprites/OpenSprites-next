/**
 * js/share.js
 * -----------
 * 
 * Black magic for the Share page.
 */

const template = require('./template')

function addResourceInput() {
  const dialog = template('file-upload')
  const fileInput = dialog.querySelector('.file-select-button')
  fileInput.addEventListener('change', function(event) {
    dialog.classList.add('has-file')
    readFile(dialog, event).then(reader => {
        console.log(reader.result)
      })
  })
  document.getElementById('file-uploads').appendChild(dialog)
}

function readFile(dialog, event) {
  return new Promise((resolve, reject) => {
    const input = event.target
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      resolve(reader)
    })
    reader.readAsArrayBuffer(input.files[0])
  })
}

module.exports = function() {
  // liam, work your page

  addResourceInput()

  document.getElementById('add-resource')
    .addEventListener('click', addResourceInput)
}
