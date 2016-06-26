/**
 * gulpfile.js
 * -----------
 * 
 * Transpiles and minifes assets.
 */

const gulp = require('gulp')
const traceur = require('gulp-traceur')
const browserify = require('gulp-browserify')
const sourcemaps = require('gulp-sourcemaps')
const stylus = require('gulp-stylus')
const postcss = require('gulp-postcss')
const autoprefixer = require('autoprefixer')
const minify = require('gulp-minify')
const clean = require('gulp-clean')
const plumber = require('gulp-plumber')
const rucksack = require('rucksack-css')
const imagemin = require('gulp-imagemin')

/////////////////////////////////////////////////////////

gulp.task('build', ['build-server', 'build-js', 'build-css', 'build-img'])

gulp.task('watch', function() {
  gulp.watch('server/**/*.js', ['build-server'])
  gulp.watch(['public/assets/js/**/*', '!public/assets/js/.dist/**/*'], ['build-js'])
  gulp.watch(['public/assets/css/**/*', '!public/assets/css/.dist/**/*'], ['build-css'])
  gulp.watch(['public/assets/img/**/*', '!public/assets/img/.dist/**/*'], ['build-img'])
})

/////////////////////////////////////////////////////////

gulp.task('clean-server', function() {
  return gulp.src('server/.dist/*', { read: false })
  .pipe(clean())
})

gulp.task('clean-js', function() {
  return gulp.src('public/assets/js/.dist/*', { read: false })
  .pipe(clean())
})

gulp.task('clean-css', function() {
  return gulp.src('public/assets/css/.dist/*', { read: false })
  .pipe(clean())
})

gulp.task('clean-img', function() {
  return gulp.src('public/assets/img/.dist/*', { read: false })
  .pipe(clean())
})

/////////////////////////////////////////////////////////

gulp.task('build-server', ['clean-server'], function() {
  return gulp.src('server/main.js')
  .pipe(plumber())
  .pipe(sourcemaps.init())
  .pipe(traceur())
  .pipe(minify({
    mangle: false
  }))
  .pipe(sourcemaps.write('.'))
  .pipe(gulp.dest('server/.dist'))
})

gulp.task('build-js', ['clean-js'], function() {
  return gulp.src('public/assets/js/main.js')
  .pipe(plumber())
  .pipe(sourcemaps.init())
  .pipe(traceur({
    modules: 'commonjs'
  }))
  .pipe(browserify({
    debug: true
  }))
  .pipe(minify({
    mangle: false,
    ext: { min: '.js' }
  }))
  .pipe(sourcemaps.write('.'))
  .pipe(gulp.dest('public/assets/js/.dist'))
})

gulp.task('build-css', ['clean-css'], function() {
  return gulp.src('public/assets/css/main.styl')
  .pipe(plumber())
  .pipe(sourcemaps.init())
  .pipe(stylus({
    compress: true
  }))
  .pipe(postcss([ autoprefixer(), rucksack() ]))
  .pipe(sourcemaps.write('.'))
  .pipe(gulp.dest('public/assets/css/.dist'))
})

gulp.task('build-img', ['clean-img'], function() {
  return gulp.src('public/assets/img/**/*')
  .pipe(plumber())
  .pipe(sourcemaps.init())
  .pipe(imagemin())
  .pipe(gulp.dest('public/assets/img/.dist'))
})