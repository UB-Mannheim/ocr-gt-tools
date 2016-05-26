// Name: ocr-gt-tools.js

$(function onPageLoaded() {
    var app = window.app = new App();
    app.on('app:initialized', function onInit() {
        console.info("Initialized ocr-gt app.");
    });
    app.init();
});
