function Page(imageUrl, opts) {
    this.imageUrl = imageUrl;
    for (key in opts) { this[key] = opts[key]; }
}

Page.prototype.save = function(cb) {
};

Page.prototype.load = function(cb) {
    $.ajax({
        type: 'GET',
        url: 'ocr-gt-tools.cgi?action=create&imageUrl=' + this.imageUrl,
        error: cb,
        beforeSend: function(xhr) {
            // to instantly see when a new document has been retrieved
            $("#file-correction").addClass("hidden");
            $("#dropzone").addClass('hidden');
            window.app.waitingAnimation.start();
        },
        success: function(res) {
            // file correction will be loaded
            $("#dropzone").addClass('hidden');
            window.app.currentPage = res;
            console.log(window.app.currentPage);
            window.location.hash = window.app.currentPage.url['thumb-url'];
            window.setTimeout(function() {
                // ajax
                $("#raw-html").load(
                    Utils.uncachedURL(window.app.currentPage.url['correction-url']),
                    function handleCorrectionAjax(response, status, xhr) {
                        $.ajax({
                            type: 'GET',
                            url: Utils.uncachedURL(window.app.currentPage.url['comment-url']),
                            error: httpError,
                            success: function(response, status, xhr) {
                                Utils.parseLineComments(response, window.app.currentPage);
                                addCommentFields();
                                // show new document
                                $("#file-correction").removeClass("hidden");
                                $("ul.navbar-nav li").removeClass("disabled");
                                onScroll();
                                window.app.waitingAnimation.stop();
                            }
                        });
                    }
                );
            }, 1);
            // Zoom buttons only for non-IE
            $("#zoom-in").removeClass("hidden");
            $("#zoom-out").removeClass("hidden");
            $("#save_button").removeClass("hidden");
            // activate button if #file-correction is changed
        },
    });
};
