/**
 * js/md.js
 * --------
 * 
 * Applies to pages with .bio elements
 */

const ajax = require('axios')
const marked = require('marked')
const htmldec = require('htmldec')

let timeoutId

module.exports = function() {
  let bio_raw = htmldec(window.bio_raw)
      bio_raw = bio_raw.substr(1, bio_raw.length - 2)
  let bio = document.querySelector('.bio')

  let csrfToken = window.csrf

  bio.addEventListener('keyup', function(e){
    if(e.which == 13 && e.ctrlKey){
      this.blur()
    }
  })
  
  bio.addEventListener('focus', function(e) {
    bio.innerText = bio_raw
  })

  bio.addEventListener('blur', async function(e) {
    bio_raw = bio.innerText
    bio.style.pointerEvents = 'none'
    
    clearTimeout(timeoutId)

    document.querySelector('.bio ~ small').innerHTML = 'Saving...'

    try {
      let res = await ajax.put(window.location.pathname + '/about', {
        md: bio_raw,
        csrf: csrfToken
      })
      
      bio_raw = JSON.parse(res.request.responseText).about

      document.querySelector('.bio ~ small').innerHTML = 'Saved'
      timeoutId = setTimeout(function(){
        document.querySelector('.bio ~ small').innerHTML = '&nbsp;'
      }, 2000)
      
      bio.innerHTML = marked(bio_raw, {
        sanitize: true
      })
    } catch(err) {
      document.querySelector('.bio ~ small').innerHTML = 'Error'
      console.log(err)
    }

    bio.style.pointerEvents = 'initial'
  })
  
}