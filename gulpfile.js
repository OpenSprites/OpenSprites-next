/**
 * gulpfile.js
 * -----------
 * 
 * Transpiles and minifes assets.
 */

const gulp = require('gulp')
const gutil = require('gulp-util')
const es6ify = require('es6ify')
const browserify = require('browserify')
const sourcemaps = require('gulp-sourcemaps')
const stylus = require('gulp-stylus')
const postcss = require('gulp-postcss')
const minify = require('gulp-minify')
const clean = require('gulp-clean')
const plumber = require('gulp-plumber')
const traceur = require('gulp-traceur')
const imagemin = require('gulp-imagemin')
const source = require('vinyl-source-stream')
const buffer = require('vinyl-buffer')

es6ify.traceurOverrides = { asyncFunctions: true }

/////////////////////////////////////////////////////////

gulp.task('build', ['build-server', 'build-js', 'build-css', 'build-img'])

gulp.task('watch', function() {
  gulp.watch('server/**/*.js', ['build-server'])
  gulp.watch(['public/assets/js/**/*', '!public/assets/js/.dist/**/*'], ['build-js'])
  gulp.watch(['public/assets/css/**/*', '!public/assets/css/.dist/**/*'], ['build-css'])
  gulp.watch(['public/assets/img/**/*', '!public/assets/img/.dist/**/*'], ['build-img'])
})

gulp.task('watch-static', function() {
  gulp.watch(['server/**/*.js', '!server/.dist/**/*'], ['build-server-static'])
  gulp.watch(['public/assets/js/**/*', '!public/assets/js/.dist/**/*'], ['build-js'])
  gulp.watch(['public/assets/css/**/*', '!public/assets/css/.dist/**/*'], ['build-css'])
  gulp.watch(['public/assets/img/**/*', '!public/assets/img/.dist/**/*'], ['build-img'])
})

/////////////////////////////////////////////////////////

gulp.task('clean-server', function() {
  return gulp.src('server/.dist/**/*.js', { read: false })
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
  return gulp.src([traceur.RUNTIME_PATH, 'server/entry.js'])
  .pipe(plumber())
  .pipe(sourcemaps.init()) 
  .pipe(traceur({ 
    experimental: true, 
    properTailCalls: true, 
    symbols: true, 
    arrayComprehension: true, 
    asyncFunctions: true, 
    asyncGenerators: true, 
    forOn: true, 
    generatorComprehension: true 
  }))
  .pipe(minify({ 
    mangle: false 
  }))
  .pipe(sourcemaps.write('.'))
  .pipe(gulp.dest('server/.dist'))
})

gulp.task('build-server-static', ['clean-server'], function() {
  return gulp.src([traceur.RUNTIME_PATH, 'server/**/*'])
  .pipe(plumber())
  .pipe(sourcemaps.init()) 
  .pipe(traceur({ 
    experimental: true, 
    properTailCalls: true, 
    symbols: true, 
    arrayComprehension: true, 
    asyncFunctions: true, 
    asyncGenerators: true, 
    forOn: true, 
    generatorComprehension: true 
  }))
  .pipe(minify({ 
    mangle: false 
  }))
  .pipe(sourcemaps.write('.'))
  .pipe(gulp.dest('server/.dist'))
})

gulp.task('build-js', ['clean-js'], function() {
  var b = browserify({debug: true})
    .add(es6ify.runtime).transform(es6ify)
    .require(require.resolve('./public/assets/js/main.js'), {entry: true})
  
  return b.bundle()
  .on('error', function(err){
    gutil.log(err)
    this.emit('end')
  })
  .pipe(source('main.js'))
  .pipe(buffer())
  .pipe(sourcemaps.init({loadMaps: true}))
  .pipe(minify({
    mangle: false,
    ext: { min: '.js' }
  }))
  .pipe(sourcemaps.write('./'))
  .pipe(gulp.dest('public/assets/js/.dist'))
})

gulp.task('build-css', ['clean-css'], function() {
  return gulp.src('public/assets/css/main.styl')
  .pipe(plumber())
  .pipe(stylus({
    compress: true,
    use: [
      require('rupture')()
    ]
  }))
  .pipe(postcss([ require('autoprefixer')(), require('rucksack-css')() ]))
  .pipe(gulp.dest('public/assets/css/.dist'))
})

gulp.task('build-img', ['clean-img'], function() {
  return gulp.src('public/assets/img/**/*')
  .pipe(plumber())
  .pipe(sourcemaps.init())
  .pipe(imagemin())
  .pipe(gulp.dest('public/assets/img/.dist'))
})