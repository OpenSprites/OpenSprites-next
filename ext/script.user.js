// ==UserScript==
// @name         OpenSprites Communicator
// @namespace    http://opensprites.org/communicator
// @version      1.0.0
// @description  Allows OpenSprites to communicate with Scratch
// @author       OpenSprites Team
// @match        https://scratch.mit.edu/os-ext
// ==/UserScript==
/* jshint ignore:start */

if(!window.parent) document.querySelector('#content').innerHTML = '<br> <h1> OpenSprites Extension </h1> <p> This page is used by <a href="http://opensprites.org/">OpenSprites</a> for communication with Scratch. Please see <a href="https://github.com/OpenSprites/OpenSprites-next/tree/master/ext/">this page</a> for details. </p>'
else document.write('')

window.addEventListener('message', function(e) {
  'use strict'

  const reply = function(m, d) { e.source.postMessage({m:m,d:d}, '*') }
  const msg = e.data.m
  const data = e.data.d

  if(what === 'existence') {
    reply(true)
  }

  // TODO
}, false)

/* jshint ignore:end */
