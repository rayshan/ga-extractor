spawn = require("child_process").spawn

gulp = require 'gulp'
coffee = require 'gulp-coffee'
mocha = require 'gulp-mocha'

# ==========================


gulp.task 'build', ->
  gulp.src './src/*.coffee'
    .pipe coffee()
    .pipe gulp.dest './lib'

gulp.task 'test', ['build'], ->
  gulp.src 'test/*.coffee', read: false
    .pipe mocha()
