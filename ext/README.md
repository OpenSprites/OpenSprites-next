# OpenSprites Communicator
> Extension/Userscript that allows OpenSprites to communicate with Scratch!
> See [this issue](https://github.com/OpenSprites/OpenSprites-next/issues/26) for more details.

## Usage
This extension exposes a `[postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)` API on `iframe`s pointing to [scratch.mit.edu/os-ext](https://scratch.mit.edu/os-ext) **only**.

```html
<iframe src='https://scratch.mit.edu/os-ext' id='os-communicator'></iframe>

<script>
  'use strict'

  const comms = document.getElementById('os-communicator')
  const send = function(msg, data) {
    comms.contentWindow.postMessage({ m: msg, d: data })
  }

  // use send(what, data) to talk to the Communicator
</script>
```

_TODO_
