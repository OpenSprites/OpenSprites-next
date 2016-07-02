/**
 * js/user.js
 * ----------
 * 
 * /users/xxx
 */

const ajax = require('axios')
const marked = require('marked')
const htmldec = require('htmldec')

module.exports = function() {
  let bio_raw = htmldec(window.bio_raw)
      bio_raw = bio_raw.substr(1, bio_raw.length - 2)
  let bio = document.querySelector('.bio')

  bio.addEventListener('focus', function(e) {
    bio.innerText = bio_raw
  })

  bio.addEventListener('blur', async function(e) {
    bio_raw = bio.innerText

    document.querySelector('.bio + small').innerHTML = 'Saving...'

    let res = await ajax.put(window.location.pathname + '/about', { md: bio_raw })
    bio_raw = JSON.parse(res.request.responseText)

    document.querySelector('.bio + small').innerHTML = 'Saved'

    bio.innerHTML = marked(bio_raw, {
      sanitize: true
    })

    
  })
}