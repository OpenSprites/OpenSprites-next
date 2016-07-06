let safeSites = ["opensprites.org", "scratch.mit.edu", "localhost"]

document.querySelector(".os-leaving-continue").addEventListener("click", function(){
  window.open(this.dataset.siteurl)
})

document.querySelector(".os-leaving-back").addEventListener("click", function(){
  document.querySelector(".os-leaving").classList.remove("active")
})

function displayDialog(siteurl) {
  let leaving = document.querySelector(".os-leaving")
  leaving.querySelector(".os-leaving-url").textContent = siteurl
  leaving.querySelector(".os-leaving-continue").dataset.siteurl = siteurl
  leaving.classList.add("active")
}

module.exports = function(siteurl){
  let l = document.createElement("a")
  l.href = siteurl
  
  let hostname = l.hostname
  for(let site of safeSites){
    if(hostname.endsWith(site))
      return true
  }
  
  displayDialog(siteurl)
  return false
}