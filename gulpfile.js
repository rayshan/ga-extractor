const gulp = require("gulp"),
    mocha = require("gulp-mocha"),
    babel = require("gulp-babel");

gulp.task("build", function () {
    return gulp.src("src/*.js")
        .pipe(babel({
            presets: ['es2015']
        }))
        .pipe(gulp.dest("lib"));
});

gulp.task("test", ["build"], function () {
    return gulp.src("test/*.js", {read: false})
        .pipe(mocha());
});
