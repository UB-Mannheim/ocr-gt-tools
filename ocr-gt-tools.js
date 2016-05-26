// Name: ocr-gt-tools.js

$(function onPageLoaded() {
    var app = window.app = new App();
    app.on('app:initialized', function onInit() {
        notie.alert(1, "App geladen", 1);
    });
    app.init();
});
