function Toolbar(opts) {
    for (key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}
/**
 * Increase image zoom by Settings.zoomInFactor
 */
Toolbar.prototype.zoomIn = function(e) {
    e.stopPropagation();
    $('#file-correction img').each(function() {
        Utils.scaleHeight(this, window.app.settings.zoomInFactor);
    });
};

/**
 * Decrease image zoom by Settings.zoomOutFactor
 */
Toolbar.prototype.zoomOut = function zoomOut(e) {
    e.stopPropagation();
    $('#file-correction img').each(function() {
        Utils.scaleHeight(this, window.app.settings.zoomOutFactor);
    });
};

/**
 * Reset all images to their original size
 */
Toolbar.prototype.zoomReset = function zoomReset(e) {
    e.stopPropagation();
    $('#file-correction img').each(function() {
        Utils.scaleHeight(this, 1);
    });
};


Toolbar.prototype.render = function() {
    var self = this;
    var app = window.app;

    // Save current page
    $("#save_button").on("click", app.savePage.bind(app));

    // Open history modal
    $('button[data-target="#history-modal"]').on('click', app.showHistory.bind(app));

    // Handle zooming
    $("#zoom-in").on("click", this.zoomIn);
    $("#zoom-out").on("click", this.zoomOut);
    $("#zoom-reset").on("click", this.zoomReset);

    // Handle view filtering by selectors
    this.$el.find(".set-view").on('click', function reduceView() {
        $(".view-hidden").removeClass("view-hidden");
        $("ul.list-group > *").addClass('view-hidden');
        $("ul.list-group > " + $(this).attr('data-target')).removeClass('view-hidden');
        app.emit('app:filter-view');
    });

    // Handle sorting
    $("#sort-line").on('click', function() { app.pageView.sortRowsByLine(1); });
    $("#sort-line-desc").on('click', function() { app.pageView.sortRowsByLine(-1); });
    $("#sort-width").on('click', function() { app.pageView.sortRowsByWidth(1); });
    $("#sort-width-desc").on('click', function() { app.pageView.sortRowsByWidth(-1); });

    //
    // React to events
    //
    app.on('app:changed', function enableSaveButton() {
        $("#save_button").removeClass("disabled");
    });

    app.on('app:loaded', function disableSaveButton() {
        self.$el.find(".disabled").removeClass('disabled');
        $("#save_button").addClass("disabled");
    });

    app.on('app:saving', function startSaveSpinner() {
        $("#wait_save").addClass("wait").removeClass("hidden");
        $("#disk").addClass("hidden");
    });

    app.on('app:saved', function stopSaveSpinner() {
        $("#wait_save").removeClass("wait").addClass("hidden");
        $("#disk").removeClass("hidden");
        $("#save_button").addClass("disabled");
    });
};
