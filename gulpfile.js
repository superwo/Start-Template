var gulp           = require('gulp'),
		gutil          = require('gulp-util' ),
		sass           = require('gulp-sass'),
		pug						 = require('gulp-pug'),
		plumber        = require('gulp-plumber'),
		browserSync    = require('browser-sync'),
		concat         = require('gulp-concat'),
		uglify         = require('gulp-uglify'),
		cleanCSS       = require('gulp-clean-css'),
		rename         = require('gulp-rename'),
		del            = require('del'),
		imagemin       = require('gulp-imagemin'),
		cache          = require('gulp-cache'),
		autoprefixer   = require('gulp-autoprefixer'),
		gcmq           = require('gulp-group-css-media-queries'),
		spritesmith    = require("gulp.spritesmith"),
		svgSprite = require('gulp-svg-sprite'),
    svgmin = require('gulp-svgmin'),
    cheerio = require('gulp-cheerio'),
    replace = require('gulp-replace'),
		ftp            = require('vinyl-ftp'),
		notify         = require("gulp-notify");

var paths = {
			blocks: 'blocks/',
			devDir: 'app/',
			outputDir: 'dist/'
		};

// Tasks

gulp.task('common-js', function() {
	return gulp.src([
		paths.devDir + 'js/common.js',
		])
	.pipe(concat('common.min.js'))
	.pipe(uglify())
	.pipe(gulp.dest(paths.devDir + 'js'));
});

gulp.task('js', ['common-js'], function() {
	return gulp.src([
		paths.devDir + 'libs/jquery/dist/jquery.min.js',
		paths.devDir + 'js/common.min.js', // Всегда в конце
		])
	.pipe(concat('scripts.min.js'))
	// .pipe(uglify()) // Минимизировать весь js (на выбор)
	.pipe(gulp.dest(paths.devDir + 'js'))
	.pipe(browserSync.reload({stream: true}));
});

gulp.task('browser-sync', function() {
	browserSync({
		server: {
			baseDir: paths.devDir
		},
		notify: false,
		// tunnel: true,
		// tunnel: "projectmane", //Demonstration page: http://projectmane.localtunnel.me
	});
});

gulp.task('sass', function() {
	return gulp.src(paths.blocks + '*.sass')
	.pipe(plumber())
	.pipe(sass({outputStyle: 'expand'}))
	.on("error", notify.onError(function(error) {
		return {
			title: 'SASS',
			message: error.message
		};
	}))
	.pipe(rename({suffix: '.min', prefix : ''}))
	.pipe(gcmq())
	.pipe(autoprefixer(['last 15 versions']))
	.pipe(cleanCSS()) // Опционально, закомментировать при отладке
	.pipe(gulp.dest(paths.devDir + 'css'))
	.pipe(browserSync.reload({stream: true}));
});

gulp.task('pug', function() {
	return gulp.src(paths.blocks + 'pages/*.pug')
	.pipe(plumber())
	.pipe(pug({
		pretty: true
	}))
	.on('error', notify.onError(function(error) {
		return {
			title: 'Pug',
			message: error.message
		};
	}))
	.pipe(gulp.dest(paths.devDir))
	.pipe(browserSync.reload({stream: true}));
});

gulp.task('watch', ['sass', 'js', 'browser-sync'], function() {
	gulp.watch(paths.blocks + '**/*.sass', ['sass']);
	gulp.watch(paths.blocks + '**/*.pug', ['pug']);
	gulp.watch(['libs/**/*.js', paths.devDir + 'js/common.js'], ['js']);
	gulp.watch(paths.devDir + 'img/svg/sprite/*.svg', ['svgSpriteBuild']);
	gulp.watch(paths.devDir + '*.html', browserSync.reload);
});

gulp.task('imagemin', function() {
	return gulp.src(['app/img/**/*', '!app/img/sprite/*'])
	.pipe(cache(imagemin()))
	.pipe(gulp.dest('dist/img'));
});

gulp.task('build', ['removedist', 'pug', 'imagemin', 'sass', 'js'], function() {

	var buildFiles = gulp.src([
		'app/*.html',
		'app/.htaccess',
		]).pipe(gulp.dest('dist'));

	var buildCss = gulp.src([
		'app/css/main.min.css',
		]).pipe(gulp.dest('dist/css'));

	var buildJs = gulp.src([
		'app/js/scripts.min.js',
		]).pipe(gulp.dest('dist/js'));

	var buildFonts = gulp.src([
		'app/fonts/**/*',
		]).pipe(gulp.dest('dist/fonts'));

});

gulp.task('deploy', function() {

	var conn = ftp.create({
		host:      'hostname.com',
		user:      'username',
		password:  'userpassword',
		parallel:  10,
		log: gutil.log
	});

	var globs = [
	'dist/**',
	'dist/.htaccess',
	];
	return gulp.src(globs, {buffer: false})
	.pipe(conn.dest('/path/to/folder/on/server'));

});

gulp.task('removedist', function() { return del.sync('dist'); });
gulp.task('clearcache', function () { return cache.clearAll(); });

gulp.task('default', ['watch']);


// Sprites PNG
gulp.task('cleansprite', function() {
    return del.sync('app/img/sprite/sprite.png');
});


gulp.task('spritemade', function() {
    var spriteData =
        gulp.src('app/img/sprite/*.*')
        .pipe(spritesmith({
            imgName: 'sprite.png',
            cssName: '_sprite.scss',
            padding: 15,
            cssFormat: 'scss',
            algorithm: 'binary-tree',
            cssTemplate: 'sass.template.mustache',
            cssVarMap: function(sprite) {
                sprite.name = 's-' + sprite.name;
            }
        }));

    spriteData.img.pipe(gulp.dest('app/img/sprite/')); // путь, куда сохраняем картинку
    spriteData.css.pipe(gulp.dest('app/sass/')); // путь, куда сохраняем стили
});

gulp.task('sprite', ['cleansprite', 'spritemade']);

// Sprites SVG
gulp.task('svgSpriteBuild', function () {
	return gulp.src('app/img/svg/sprite/*.*')
	// minify svg
		.pipe(svgmin({
			js2svg: {
				pretty: true
			}
		}))
		// remove all fill, style and stroke declarations in out shapes
		.pipe(cheerio({
			run: function ($) {
				$('[fill]').removeAttr('fill');
				// $('[stroke]').removeAttr('stroke');
				$('[style]').removeAttr('style');
			},
			parserOptions: {xmlMode: true}
		}))
		// cheerio plugin create unnecessary string '&gt;', so replace it.
		.pipe(replace('&gt;', '>'))
		// build svg sprite
		.pipe(svgSprite({
			mode: {
				symbol: {
					sprite: "../sprite.svg",
					render: {
						scss: {
							dest:'../../../../app/sass/_sprite.scss',
							template: paths.blocks + "templates/_sprite_template.scss"
						}
					},
          example: false
				}
			}
		}))
		.pipe(gulp.dest('app/img/svg'));
});
