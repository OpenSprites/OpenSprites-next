const ajax = require('axios')

module.exports = function comment() {
  document.querySelector('.post-comment .btn').addEventListener('click', async function() {
    const comment = document.querySelector('.post-comment')
    const what = document.querySelector('.post-comment textarea').value
    const btn = document.querySelector('.post-comment .btn')

    btn.innerText = 'posting...'
    comment.style.pointerEvents = 'none'

    let pageType = 'unknown'

    if(window.location.pathname.startsWith('/resource')) {
      pageType = 'resource'
    }

    if(window.location.pathname.startsWith('/users')) {
      pageType = 'user'
    }

    if(window.location.pathname.startsWith('/collections')) {
      pageType = 'collection'
    }

    try {
      await ajax({
        url: '/comment',
        method: 'post',
        headers: {
          'X-CSRF-Token': window.csrf
        },
        data: {
          pageType,
          id: window._id,
          what
        }
      })

      btn.innerText = 'posted'
      window.location.reload()
    } catch(e) {
      btn.innerText = 'failed!'

      window.setTimeout(() => {
        btn.innerText = 'post'
        comment.style.pointerEvents = 'initial'
      }, 720)
    }
  })
}