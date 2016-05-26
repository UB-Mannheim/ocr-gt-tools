// TODO

function addMultiComment() {
    var tag = '#' + $(this).attr('data-tag');
    $('.selected .line-comment').each(function() {
        addTagToElement($("div[contenteditable]", $(this)), tag);
    });
}

function changeSelection(action) {
    $('.select-col').each(function() {
        var $this = $(this);
        var isSelected = $this.closest('.row').hasClass('selected');
        if (action === 'select' && !isSelected) {
            $this.trigger('click');
        } else if (action === 'unselect' && isSelected) {
            $this.trigger('click');
        } else if (action === 'toggle') {
            $this.trigger('click');
        }
    });
}

/******************/
/* Event handlers */
/******************/

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

function toggleSelectMode() {
    $(".selected").toggleClass('selected');
    $(".select-col").toggleClass('hidden');
    $(".button-col").toggleClass('hidden');
    $("#select-bar").toggleClass('hidden');
}

function App() {

    // A dummy element, just used for event emitting/listening
    this.$el = $("<div>");

    // Set up models
    this.settings = new Settings();
    this.history = new History();
    this.errorTags = new ErrorTags();
    this.cheatsheet = new Cheatsheet();

    // Select mode initially off
    this.selectMode = false;

    // Compile templates
    this.templates = Utils.compileTemplates();
}

App.prototype.on = function() {
    if (this.settings.debug) console.debug('BIND', arguments[0], ' -> ', arguments[1].name || arguments[1]);
    this.$el.on.apply(this.$el, arguments);
};

App.prototype.emit = function() {
    if (this.settings.debug) console.debug('emit', arguments[0], arguments[1] || '');
    var event = arguments[0];
    if (event === 'app:saved') {
        notie.alert(1, "Gespeichert", 1);
    } else if (event === 'app:ajaxError') {
        notie.alert(3, "HTTP Fehler " + xhr.status + ":\n<pre style='text-align: left'>" + xhr.responseText + "</pre>");
    }
    this.$el.trigger.apply(this.$el, arguments);
};

App.prototype.toggleSelectMode = function() {
    this.selectMode = !this.selectMode;
    this.emit('app:' + (this.selectMode ? 'enter' : 'exit') + '-select-mode');
};

App.prototype.confirmExit = function confirmExit() {
    console.log("CONFIRM");
    if (this.currentPage && this.currentPage.changed) {
        notie.alert(2, "Ungesicherte Inhalte vorhanden, bitte zuerst speichern!", 5);
        return "Ungesicherte Inhalte vorhanden, bitte zuerst speichern!";
    }
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

    // Setup event handlers for drag and drop
    // TODO
    setupDragAndDrop();

    // Render views
    this.waitingAnimation.render();
    this.cheatsheetView.render();
    this.toolbar.render();
    this.dropzone.render();

    this.on('app:loading', function hidePageView() { self.pageView.$el.addClass('hidden'); });
    this.on('app:loaded',  function showPageView() { self.pageView.$el.removeClass('hidden'); });

    // Select Mode
    // TODO
    $("#toggle-select").on('click', toggleSelectMode);
    $("#select-bar .close").on('click', toggleSelectMode);
    $('.add-multi-comment').on('click', addMultiComment);

    // TODO
    $("#load-image button").on('click', function() {
        window.location.hash = '#' + $("#load-image input").val();
    });
    // TODO
    $(".select-all").on('click', function() { changeSelection('select'); });
    $(".select-none").on('click', function() { changeSelection('unselect'); });
    $(".select-toggle").on('click', function() { changeSelection('toggle'); });
};

App.prototype.init = function init() {
    var self = this;

    // Set up views
    this.toolbar = new Toolbar({
        'el': '#toolbar'
    });
    this.sidebar = new Sidebar({
        'el': '#right-sidebar'
    });
    this.pageView = new PageView({
        'el': "#file-correction",
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

    // Load cheatsheet and errorTags
    async.each([this.cheatsheet, this.errorTags], function(model, done) {
        model.load(done);
    }, function(err) {
        if (err) return self.emit('app:ajaxError', err);
        // TODO
        window.onhashchange = function onHashChange() {
            var cHash = window.location.hash.substring(1);
            if (cHash !== '') {
                self.loadPage(cHash);
            }
        };
        // TODO
        window.onbeforeunload = self.confirmExit.bind(self);
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
    if (self.confirmExit()) {
        return;
    }
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

