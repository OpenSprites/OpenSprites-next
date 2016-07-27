const imagemin = require('imagemin');
const imageminGifsicle = require('imagemin-gifsicle');
const imageminJpegtran = require('imagemin-jpegtran');
const imageminOptipng = require('imagemin-optipng');
const imageminSvgo = require('imagemin-svgo');

const use = [
  imageminGifsicle(),
  imageminJpegtran(),
  imageminOptipng(),
  imageminSvgo()
]

module.exports = function(buffer) {
  return imagemin.buffer(buffer, {use})
}