let content = `

OpenSprites uses cookies. By continuing to use OpenSprites you agree to our use of cookies. For more information, see our <a href="/privacy">Privacy Policy</a>.

<br>

<a class="btn" onclick="this.parentElement.style.display='none'; localStorage['cookies']='true'">Got it</a>

`

if(!localStorage['cookies']){
  let div = document.createElement('div')
  div.id = 'cookie-policy'
  div.innerHTML = content
  //document.body.appendChild(div) // see #88
}
