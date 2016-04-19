module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('bower.json'),
        concat: {
            options: {
                separator: ';',
                sourceMap: true,
            },
            dist: {
                src: [
                    'bower_components/jquery/dist/jquery.js',
                    'bower_components/bootstrap/dist/js/bootstrap.js',
                    'js/**/*.js',
                ],
                dest: 'dist/<%= pkg.name %>.js'
            }
        },
        cssmin: {
            options: {
                shorthandCompacting: false,
                roundingPrecision: -1,
                sourceMap: true,
                keepBreaks: true
            },
            target: {
                files: {
                    'dist/css/<%= pkg.name %>.css': [
                        'bower_components/bootstrap/dist/css/bootstrap.css',
                        'bower_components/bootstrap/dist/css/bootstrap-theme.css',
                        'css/ocr-gt-tools.css'
                    ]
                }
            }
        },
        uglify: {
            options: {
                banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy HH-MM") %> */\n'
            },
            dist: {
                files: {
                    'dist/<%= pkg.name %>.min.js': ['<%= concat.dist.dest %>']
                }
            }
        },
        jscs: {
            src: "js/**/*.js",
            options: {
                config: ".jscsrc",
                esnext: false, // If you use ES6 http://jscs.info/overview.html#esnext
                verbose: true, // If you need output with rule names http://jscs.info/overview.html#verbose
                fix: false, // Autofix code style violations when possible.
            }
        },
        watch: {
            files: ['js/**/*.js', 'css/**/*.css'],
            tasks: ['default']
        },
        clean: ['dist']
    });

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-jscs');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.registerTask('lint', ['jscs']);

    grunt.registerTask('default', ['jscs', 'concat', 'uglify', 'cssmin']);

};
