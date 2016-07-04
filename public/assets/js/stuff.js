const AudioThumb = require('./audio-thumb')
const ajax = require('axios')
const htmldec = require('htmldec')

module.exports = function(){
  let atElem = document.querySelector('.audio-thumb')
  if(atElem) {
    AudioThumb(location.pathname.substring(location.pathname.lastIndexOf('/') + 1), function(dataurl){
      document.querySelector(".audio-thumb-container").classList.add("fade-out")
      setTimeout(function(){
        atElem.src = dataurl
        document.querySelector(".audio-thumb-container .loader").style.display = "none"
        document.querySelector(".audio-thumb-container").classList.remove("fade-out")
      }, 200)
    })
  }
  
  let title = document.querySelector(".resource-title")
  title.addEventListener("blur", async function(){
    let title_raw = title.innerText

    document.querySelector('.resource-title ~ small').innerHTML = 'Saving...'

    try {
      let csrfToken = htmldec(window.csrfToken)
      csrfToken = csrfToken.substr(1, csrfToken.length - 2)
      
      let res = await ajax.put(window.location.pathname + '/about', {
        title: title_raw,
        csrf: csrfToken
      })
      title_raw = JSON.parse(res.request.responseText).title
      title.innerText = title_raw
      
      document.querySelector('.resource-title ~ small').innerHTML = 'Saved'
    } catch(err){
      document.querySelector('.resource-title ~ small').innerHTML = 'Error'
      console.log(err)
    }
  })
}