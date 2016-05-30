function setupDragAndDrop() {
    // Prevent the default browser drop action
    $(document).bind('drop dragover', function(e) {
        e.preventDefault();
    });
    // Show the drop zone on as soon as something is dragged
    $(document)
        .bind('dragenter', function onDragEnter(e) {
            e.preventDefault();
            $("#file-correction").addClass('hidden');
            $("#dropzone").removeClass('hidden');
        })
        .bind('dragend', function onDragEnd(e) {
            e.preventDefault();
            $("#file-correction").removeClass('hidden');
            $("#dropzone").addClass('hidden');
        });
    $("#dropzone")
        .bind('dragover dragenter', function onDragOver(e) {
            e.preventDefault();
            $("#dropzone").addClass('droppable').removeClass('hidden');
        })
        .bind('dragenter', function onDragEnterDropZone(e) {
            e.stopPropagation();
        })
        .bind('dragleave', function onDragLeaveDropZone(e) {
            e.preventDefault();
            $("#dropzone").removeClass('droppable').addClass('hidden');
        })
        .bind('drop', function onDrop(e) {
            e.preventDefault();

            if (window.app.currentPage && window.app.currentPage.changed) {
                notie.alert(2, "Ungesicherte Inhalte vorhanden, bitte zuerst speichern!", 2);
            } else {
                var url = Utils.getUrlFromDragEvent(e);
                if (url) {
                    window.app.loadPage(url);
                } else {
                    notie.alert(3, "Konnte keine URL erkennen.");
                }
            }
        });
}

function App() {

    // A dummy element, just used for event emitting/listening
    this.$el = $("<div>");

    // Set up models
    this.settings = new Settings();
    this.history = new History();
    this.errorTags = new ErrorTags();
    this.cheatsheet = new Cheatsheet();

    // Compile templates
    this.templates = Utils.compileTemplates();
}

App.prototype.on = function() {
    if (this.settings.debug) console.info('bind', arguments[0], ' -> ', arguments[1].name || arguments[1]);
    this.$el.on.apply(this.$el, arguments);
    return this;
};
App.prototype.once = function() {
    if (this.settings.debug) console.info('bind', arguments[0], ' -> ', arguments[1].name || arguments[1]);
    this.$el.one.apply(this.$el, arguments);
    return this;
};


App.prototype.emit = function() {
    if (this.settings.debug) console.log('emit', arguments[0], arguments[1] || '');
    var event = arguments[0];
    if (event === 'app:saved') {
        notie.alert(1, "Gespeichert", 1);
    } else if (event === 'app:ajaxError') {
        notie.alert(3, "HTTP Fehler " + xhr.status + ":\n<pre style='text-align: left'>" + xhr.responseText + "</pre>");
    }
    this.$el.trigger.apply(this.$el, arguments);
    return this;
};

App.prototype.confirmExit = function confirmExit() {
    if (this.currentPage && this.currentPage.changed) {
        notie.alert(2, "Ungesicherte Inhalte vorhanden, bitte zuerst speichern!", 5);
        return "Ungesicherte Inhalte vorhanden, bitte zuerst speichern!";
    }
};

App.prototype.onHashChange = function onHashChange(e) {
    e.preventDefault();
    var newHash = window.location.hash;
    console.log(e.oldURL);
    if (!e.oldURL) {
        console.info('HashChange (initial) -> ', newHash);
    } else {
        var oldHash = e.oldURL.substr(e.oldURL.indexOf('#'));
        console.info('HashChange', oldHash, ' -> ', newHash);
        if (oldHash === newHash) {
            return;
        }
        if (this.confirmExit()) {
            window.location.hash = '#' + this.currentPage.imageUrl;
            return;
        }
    }
    if (newHash.length > 2)
        this.loadPage(newHash.substr(1));
};

App.prototype.showHistory = function() {
    var self = this;
    this.history.load(function(err) {
        if (err) {
            return self.emit('app:ajaxError', err);
        }
        self.historyView.render();
    });
};

App.prototype.render = function() {

    var self = this;

    // Select mode initially off
    this.selectMode = false;

    // Setup event handlers for drag and drop
    // TODO
    setupDragAndDrop();

    // Render views
    this.waitingAnimation.render();
    this.cheatsheetView.render();
    this.toolbar.render();
    this.selectbar.render();
    this.dropzone.render();

    this.on('app:loading', function hideSidebar() { self.sidebar.$el.addClass('hidden'); });
    this.on('app:loading', function hidePageView() { self.pageView.$el.addClass('hidden'); });
    this.on('app:loaded',  function showSidebar() { self.sidebar.$el.removeClass('hidden'); });
    this.on('app:loaded',  function showPageView() { self.pageView.$el.removeClass('hidden'); });
};

App.prototype.init = function init() {
    var self = this;

    // window global events
    window.onbeforeunload = self.confirmExit.bind(self);
    window.onhashchange = self.onHashChange.bind(self);

    // Set up views
    this.pageView  = new PageView({'el': "#file-correction",});
    this.dropzone  = new Dropzone({'el': '#dropzone'});
    this.toolbar   = new Toolbar({'el': '#toolbar'});
    this.sidebar   = new Sidebar({'el': '#right-sidebar'});
    this.selectbar = new Selectbar({'el': '#select-bar'});
    this.waitingAnimation = new WaitingAnimation({
        'el': "#waiting-animation",
        'model': this.cheatsheet
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

    // Load cheatsheet and errorTags
    async.each([this.cheatsheet, this.errorTags], function(model, done) {
        model.load(done);
    }, function(err) {
        if (err) return self.emit('app:ajaxError', err);
        self.settings.load();
        self.render();
        // Trigger hash change
        $(window).trigger('hashchange');
        self.$el.trigger('app:initialized');
    });
};

App.prototype.savePage = function savePage() {
    var self = this;
    this.emit('app:saving');
    window.app.currentPage.save(function(err) {
        if (err) {
            self.emit('app:ajaxError', err);
        } else {
            self.emit('app:saved');
        }
    });
};

App.prototype.loadPage = function loadPage(url) {
    var self = this;
    if (self.confirmExit()) return;
    this.emit('app:loading');
    this.currentPage = new Page(url);
    this.currentPage.load(function(err) {
        if (err) {
            return self.emit('app:ajaxError', err);
        }
        self.pageView.model = self.currentPage;
        self.pageView.render();
        self.sidebar.model = self.currentPage;
        self.sidebar.render();
        self.emit('app:loaded');
    });
};

