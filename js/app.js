function App() {
    this.$el = $("<div>");
    this.templates = compileTemplates();

    // Set up models
    this.history = new History();
    this.errorTags = new ErrorTags();
    this.cheatsheet = new Cheatsheet();

    // Set up views
    this.pageView = new PageView({
        'el': "#file-correction",
        'tpl': this.templates.line,
    });
    this.historyView = new HistoryView({
        'el': "#history-modal",
        'model': this.history,
        'tpl': this.templates.historyItem,
    });
    this.cheatsheetView = new CheatsheetView({
        'el': "#cheatsheet-modal",
        'model': this.cheatsheet,
        'tpl': this.templates.cheatsheetEntry,
    });
    this.waitingAnimation = new WaitingAnimation({
        'el': "#waiting-animation",
        'model': this.cheatsheet,
    });
    this.dropzone = new Dropzone({
        'el': '#dropzone'
    });
}

App.prototype.render = function() {
    // event listeners
    $("#save_button").on("click", saveGtEditLocation);

    // Handle zooming
    $("#zoom-in").on("click", zoomIn);
    $("#zoom-out").on("click", zoomOut);
    $("#zoom-reset").on("click", zoomReset);

    // Notice changed input and make save button available
    $("#file-correction").on('input', markChanged);
    $("#right-sidebar").on('input', markChanged);

    // Open history modal
    $('button[data-target="#history-modal"]').on('click', function() {
        app.history.load(function(err) {
            if (err) { return httpError(err); }
            console.log(app);
            app.historyView.render();
        });
    });

    // Select Mode
    $("#toggle-select").on('click', toggleSelectMode);
    $("#select-bar .close").on('click', toggleSelectMode);
    $('.add-multi-comment').on('click', addMultiComment);
    $(".set-view").on('click', function() {
        reduceViewToSelectors($(this).attr('data-target').split(/\s*,\s*/));
    });

    $("#sort-line").on('click', function() { sortRowsByLine(1); });
    $("#sort-line-desc").on('click', function() { sortRowsByLine(-1); });
    $("#sort-width").on('click', function() { sortRowsByWidth(1); });
    $("#sort-width-desc").on('click', function() { sortRowsByWidth(-1); });

    $("#load-image button").on('click', function() {
        window.location.hash = '#' + $("#load-image input").val();
    });
    $(".select-all").on('click', function() { changeSelection('select'); });
    $(".select-none").on('click', function() { changeSelection('unselect'); });
    $(".select-toggle").on('click', function() { changeSelection('toggle'); });
};

App.prototype.init = function() {
    var self = this;
    async.each([this.cheatsheet, this.errorTags], function(model, done) {
        model.load(done);
    }, function(err) {
        if (err) { return httpError(err); }
        self.$el.trigger('app:initialized');
    });
};

// TODO
App.prototype.loadPage = function(url) {
    var self = this;
    this.$el.trigger('app:before-load');

    // to instantly see when a new document has been retrieved
    $("#file-correction").addClass("hidden");
    window.app.waitingAnimation.start();
    // file correction will be loaded
    $("#dropzone").addClass('hidden');

    this.currentPage = new Page(url);
    this.currentPage.load(function(err) {
        if (err) { return httpError(err); }
        self.pageView.model = self.currentPage;
        self.pageView.render();
        self.waitingAnimation.stop();
        $("#file-correction").removeClass("hidden");
        // activate button if #file-correction is changed
        self.$el.trigger('app:after-load');
    });
};

