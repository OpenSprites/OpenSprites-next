/**
 * js/user.js
 * ----------
 * 
 * /users/xxx
 */

const ajax = require('axios')
const marked = require('marked')

module.exports = function() {
  let bio_raw = window.bio_raw
  let bio = document.querySelector('.bio')

  bio.addEventListener('focus', function(e) {
    bio.innerText = bio_raw
  })

  bio.addEventListener('blur', async function(e) {
    bio_raw = bio.innerText
    bio.innerHTML = marked(bio_raw)

    document.querySelector('.bio + small').innerHTML = 'Saving...'

    await ajax.put(window.location.pathname + '/about', {
      params: {
        md: bio_raw
      }
    })

    document.querySelector('.bio + small').innerHTML = 'Saved'
  })
}