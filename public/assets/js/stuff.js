const AudioThumb = require('./audio-thumb')

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
}