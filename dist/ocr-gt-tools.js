/********************/
/* Utiliy functions */
/********************/

var Utils = {};

/**
 * Scale the 'height' attribute of an element by a factor,
 * effectively zooming images.
 *
 * @param {DOMElement} el the element to scale
 * @param {float} factor the scale factor
 */
Utils.scaleHeight = function scaleHeight(el, factor) {
    var curHeight = el.getAttribute('height') || el.offsetHeight;
    if (!el.hasAttribute('data-original-height')) {
        el.setAttribute('data-original-height', curHeight);
    }
    var originalHeight = el.getAttribute('data-original-height');
    var newHeight = factor == 1 ? originalHeight : curHeight * factor;
    el.setAttribute('height',  newHeight);
};

/**
 * Get the width of the first image in an element.
 */
Utils.getImageWidth = function getImageWidth(el) {
    if (el.tagName !== 'IMG') {
        el = $(el).find('img')[0];
        if (!el) {
            return -1;
        }
    }
    return el.clientWidth;
};

Utils.encodeForBrowser = function encodeForBrowser(str) {
    if (typeof str === 'undefined') {
        return '';
    }
    return str
        .replace(/&amp;/g, '&')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/^\n*/, '')
        .replace(/\n*$/, '')
        .replace(/\n/g, '<br>');
};

Utils.getUrlFromDragEvent = function getUrlFromDragEvent(e) {
    var elem = e.originalEvent.dataTransfer.getData('text/html');
    var url = $(elem).find('img').addBack('img').attr('src');
    if (!url) {
        url = $(elem).find('a').addBack('a').attr('href');
    }
    if (!url) {
        url = e.originalEvent.dataTransfer.getData('text/plain');
    }
    return url;
};

/**
 * Compile the Handlebars templates
 */
Utils.compileTemplates = function compileTemplates() {
    var templates = {};
    $("*[id^='tpl-']").each(function() {
        var $this = $(this);
        var tplId = $this.attr('id').replace(/^tpl-/, '');
        templates[tplId] = Handlebars.compile($this.html());
    });
    return templates;
};

/**
 * Shrink/expand a textarea to fit its contents
 */
Utils.fitHeight = function fitHeight(selector) {
    $(selector).each(function() {
        $(this)
            .attr('rows', 1) // Must be one for single-line textareas
            .css({'height': 'auto', 'overflow-y': 'hidden', 'resize': 'none'})
            .height(this.scrollHeight);
    });
};
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
        var xhr = arguments[1];
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

function History() { }
History.prototype.url = 'ocr-gt-tools.cgi?action=history&mine=true';
History.prototype.load = function(cb) {
    var self = this;
    $.ajax({
        url: this.url,
        dataType: "json",
        error: cb,
        success: function(data) {
            notie.alert(1, "History geladen", 1);
            self.items = data;
            cb(null, self);
        },
    });
};


var defaultSettings = {
    zoomInFactor: 1.4,
    zoomOutFactor: 0.8,
    debug: true,
    cgiUrl: 'ocr-gt-tools.cgi',
    defaultViews: ['.transcription','img'],
    animationTimeout: 5000,
    animationsPerRound: 50,
    animationInterval: 100,
};

function Settings(opts) {
    for (var k in defaultSettings) { this[k] = defaultSettings[k]; }
}

Settings.prototype.load = function loadSettings() {
    console.log("NOT IMPLEMENTED");
};

Settings.prototype.save = function loadSettings() {
    console.log("NOT IMPLEMENTED");
};

function ErrorTags() {
    this.items = [];
}
ErrorTags.prototype.url = 'error-tags.json';
ErrorTags.prototype.load = function(cb) {
    var self = this;
    $.ajax({
        url: this.url,
        dataType: "json",
        error: cb,
        success: function(data) {
            self.items = [];
            var keys = Object.keys(data);
            for (var i = 0; i < keys.length; i++) {
                self.items.push(data[keys[i]]);
            }
            cb();
        },
    });
};
function Cheatsheet() {
    this.items = [];
}
Cheatsheet.prototype.url = 'special-chars.json';
Cheatsheet.prototype.load = function(cb) {
    var self = this;
    $.ajax({
        url: this.url,
        dataType: "json",
        error: cb,
        success: function(data) {
            self.items = [];
            var keys = Object.keys(data);
            for (var i = 0; i < keys.length; i++) {
                var cheatsheetEntry = data[keys[i]];
                // console.log(cheatsheetEntry.id, cheatsheetEntry.recognition);
                self.items.push(cheatsheetEntry);
            }
            cb();
        },
    });
};

function Line(opts) {
    for (key in opts) { this[key] = opts[key]; }
    this.changed = false;
}

Line.prototype.getTags = function getTags() {
    var ret = {};
    this.comment.replace(/(#[a-z0-9-]+)\s*([^\n#]+)?/g, function(_, tag, desc) {
        ret[tag] = desc;
    });
    return ret;
};

Line.prototype.addTag = function addTag(tag, desc) {
    desc = desc || '';
    if (this.getTags().hasOwnProperty(tag)) {
        console.info("Already has this tag: " + tag);
        return;
    }
    this.comment = (this.comment.trim() + "\n" + tag.trim() + " " + desc.trim()).trim();
    return true;
};
function Page(urlOrOpts) {
    var self = this;
    self.lines = [];
    if (typeof urlOrOpts === 'string') {
        self.imageUrl = urlOrOpts;
    } else {
        self.imageUrl = urlOrOpts.imageUrl;
        for (key in urlOrOpts) { self[key] = urlOrOpts[key]; }
    }
    self.changed = false;
    window.app.on('app:changed', function setChanged() { self.changed = true; });
    window.app.on('app:saved', function setUnChanged() { self.changed = false; });
}

Page.prototype.toJSON = function() {
    var ret = {
        'line-comments': [],
        'line-transcriptions': [],
        'page-comment': this['page-comment'],
        'ids': this.ids,
        'url': this.url,
    };
    for (var i = 0; i < this.lines.length ; i++) {
        ret['line-comments'][i] = this.lines[i].comment.trim();
        ret['line-transcriptions'][i] = this.lines[i].transcription.trim();
    }
    return ret;
};

Page.prototype.save = function savePage(cb) {
    $.ajax({
        type: 'POST',
        url: 'ocr-gt-tools.cgi?action=save',
        contentType: 'application/json; charset=UTF-8',
        data: JSON.stringify(this.toJSON()),
        success: function() { cb(); },
        error: cb
    });
};

Page.prototype.load = function(cb) {
    var self = this;
    $.ajax({
        type: 'GET',
        url: 'ocr-gt-tools.cgi?action=get&imageUrl=' + this.imageUrl,
        error: cb,
        success: function(res) {
            for (key in res) { self[key] = res[key]; }
            // Sort 'pages'
            self.pages = self.pages.sort(function(a, b) { return parseInt(a.ids.page) - parseInt(b.ids.page); });
            // Create line models
            for (var i = 0; i < self['line-transcriptions'].length; i++)  {
                self.lines.push(new Line({
                    id: i,
                    transcription: self['line-transcriptions'][i],
                    comment: self['line-comments'][i],
                    image: self['line-images'][i],
                }));
            }
            cb();
        },
    });
};
function PageView(opts) {
    for (var key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
    this.lineViews = [];
}

/**
 * Sort the rows by image width
 *
 * @param {number} order Sort descending (-1) or ascending (1, default)
 */
PageView.prototype.sortRowsByWidth = function sortRowsByWidth(order) {
    var order = order || 1;
    this.$el.html(
        this.$el.find(".row").sort(function(a, b) {
            var aWidth = Utils.getImageWidth(a);
            var bWidth = Utils.getImageWidth(b);
            return (aWidth - bWidth) * order;
        }).detach()
    );
};

/**
 * Sort the rows by line number
 *
 * @param {number} order Sort descending (-1) or ascending (1, default)
 */
PageView.prototype.sortRowsByLine = function sortRowsByLine(order) {
    var order = order || 1;
    this.$el.html(
        this.$el.find(".row").sort(function(a, b) {
            var aLine = $(a).attr('id').replace(/[^\d]/g, '');
            var bLine = $(b).attr('id').replace(/[^\d]/g, '');
            return (aLine - bLine) * order;
        }).detach()
    );
};

PageView.prototype.render = function() {
    this.$el.find('*').off().empty();
    // render lines
    for (var i = 0; i < this.model.lines.length; i++)  {
        var lineModel = this.model.lines[i];
        var lineEl = $(window.app.templates.lineContainer(lineModel)).appendTo(this.$el);
        var lineView = new LineView({"$el": lineEl, "model": lineModel});
        lineView.render();
        this.lineViews.push(lineView);
    }
};
function LineView(opts) {
    for (var key in opts) { this[key] = opts[key]; }
    this.tpl = window.app.templates.line;
    window.app.once('app:loaded', this.render.bind(this));
    window.app.on('app:filter-view', this.renderToggler.bind(this));
    window.app.on('app:enter-select-mode', this.renderCheckbox.bind(this));
    window.app.on('app:exit-select-mode', this.renderCheckbox.bind(this));
}

/*
 * Render (or do not render) the checkbox for multi-select mode
 */
LineView.prototype.renderCheckbox = function renderComment() {
    var self = this;
    // Selectionmode
    this.$el.find('.select-col').toggleClass('hidden', !window.app.selectMode);
    this.$el.find('.button-col').toggleClass('hidden', window.app.selectMode);
    this.$el.toggleClass('selected', this.selected);
    this.$el.find(':checkbox').prop('checked', this.selected);
};

LineView.prototype.renderTextarea = function renderTextarea() {
    // fit height
    Utils.fitHeight(this.$el.find('textarea'));
};

/**
 * Update the color of the comment toggle button depending on whether line has
 * comments or not.
 */
LineView.prototype.renderToggler = function renderToggler() {
    var lineComment = this.$el.find('.line-comment');
    var isVisible = lineComment.is(':visible');
    var hasComment = this.model.comment.length > 0;
    var $toggler = this.$el.find(".toggle-line-comment");
    $toggler.find(".show-line-comment").toggleClass('hidden', isVisible);
    $toggler.find(".hide-line-comment").toggleClass('hidden', !isVisible);
    $toggler.toggleClass('btn-default', !hasComment).toggleClass('btn-info', hasComment);
};

LineView.prototype.addTag = function addTag(tag) {
    this.model.addTag(tag);
    this.render();
};

LineView.prototype.onInput = function onInput() {
    this.model.comment = this.$el.find('.line-comment textarea ').val().trim();
    this.model.transcription = this.$el.find('.line-transcription input').val().trim();
    this.renderToggler();
    this.renderTextarea();
    window.app.emit('app:changed');
};

LineView.prototype.render = function() {
    var self = this;
    console.log("Rendering", this.model.id);

    // Build from template
    this.$el.off().find("*").off();
    this.$el.html($(self.tpl(this.model)));

    // data binding
    this.$el.on('input', self.onInput.bind(this));

    // Mark line selected on click in select mode
    this.$el.on('click', function() {
        if (window.app.selectMode) {
            self.selected = !self.selected;
            self.renderCheckbox();
        }
    });

    // Add error tag on click
    this.$el.find("*[data-tag]").on('click', function() {
        self.addTag($(this).attr('data-tag'));
        window.app.emit('app:changed');
    });

    // On clicking the comment toggler
    this.$el.find(".toggle-line-comment").on('click', function() {
        var commentField = self.$el.find('.line-comment');
        commentField.toggleClass('hidden', commentField.is(':visible')).removeClass('view-hidden');
        self.renderToggler();
    });

    // Render the toggle button
    this.renderToggler();

    // Render (or don't) the checkbox
    this.renderCheckbox();

    // Fit height of text area
    this.renderTextarea();

    return this;
};
function HistoryView(opts) {
    for (key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}
HistoryView.prototype.render = function() {
    this.$el.find("tbody").empty();
    for (var i = 0; i < this.model.items.length ; i++) {
        this.$el.find("tbody").append(this.tpl(this.model.items[i]));
    }
};

function CheatsheetView(opts) {
    for (key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
    // Setup clipboard
    new Clipboard('.code');
}

CheatsheetView.prototype.applyFilter = function applyFilter() {
    var self = this;
    $.each(self.model.items, function(id, desc) {
        if (self.filter &&
            self.filter !== "" &&
            desc.baseLetter.indexOf(self.filter) === -1 &&
            desc.baseLetter.indexOf(self.filter.toLowerCase()) === -1) {
            $("#cheatsheet-" + desc.id).addClass('hidden');
        } else {
            $("#cheatsheet-" + desc.id).removeClass('hidden');
        }
    });
};

CheatsheetView.prototype.render = function render() {
    var self = this;
    self.$el.find(".cheatsheet").empty();
    $.each(self.model.items, function(idx, model) {
        self.$el.find('.cheatsheet').append(self.tpl(model));
    });
    self.$el.find('button').on('click', function() {
        notie.alert(1, "In Zwischenablage kopiert: '" + $(this).attr('data-clipboard-text') + "'", 1);
    });
    self.$el.find('input[type="text"]').on('keydown', function(e) {
        self.filter = (e.keyCode < 32 || e.ctrlKey || e.altKey) ?  null : String.fromCharCode(e.keyCode);
        self.applyFilter();
        $(this).val('');
    });
    return self;
};
function Dropzone(opts) {
    for (var key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}
Dropzone.prototype.render = function() {
    var self = this;

    $("#load-image button").on('click', function() {
        window.location.hash = '#' + $("#load-image input").val();
    });

    window.app.on('app:loading', function hideDropzone() { self.$el.addClass('hidden'); });

};
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
function Sidebar(opts) {
    for (var key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}

Sidebar.prototype.render = function renderSidebar() {
    this.$el.empty().html(window.app.templates.rightSidebar(this.model));

    var self = this;
    this.$el.on('input', function() {
        self.model['page-comment'] = self.$el.find('textarea').val();
        window.app.emit('app:changed');
    });
};
function Selectbar(opts) {
    for (var key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}

Selectbar.prototype.enter = function enter() {
    this.selectLines('unselect');
    window.app.selectMode = true;
    this.$el.removeClass('hidden');
    window.app.emit('app:enter-select-mode');
};

Selectbar.prototype.exit = function exit() {
    this.selectLines('unselect');
    window.app.selectMode = false;
    this.$el.addClass('hidden');
    window.app.emit('app:exit-select-mode');
};

Selectbar.prototype.toggle = function toggle() {
    this[window.app.selectMode ? 'exit' : 'enter']();
};

Selectbar.prototype.getSelection = function getSelection() {
    var ret = [];
    for (var i = 0; i < app.pageView.lineViews.length; i++) {
        var lineView = app.pageView.lineViews[i];
        if (lineView.selected) ret.push(lineView);
    }
    return ret;
};

Selectbar.prototype.selectLines = function selectLines(action, ids) {
    var app = window.app;
    // If no id was passed, use all ids
    if (!ids) {
        ids = [];
        for (var i = 0; i < app.currentPage.lines.length; i++) {
            ids.push(i);
        }
    }
    for (var i = 0; i < ids.length; i++) {
        var lineView = app.pageView.lineViews[ids[i]];
        lineView.selected = (action === 'select' ? true : action === 'unselect' ? false : !lineView.selected);
        lineView.renderCheckbox();
    }
};

Selectbar.prototype.render = function renderSelectBar() {
    var self = this;
    var app = window.app;

    this.$el.find('.select-all').on('click', function selectAll() {
        self.selectLines('select');
    });
    this.$el.find('.select-none').on('click', function selectNone() {
        self.selectLines('unselect');
    });
    this.$el.find('.select-toggle').on('click', function selectToggle() {
        self.selectLines('toggle');
    });
    this.$el.find('*[data-tag]').on('click', function addTagMultiple() {
        var tag = $(this).attr('data-tag');
        var selection = self.getSelection();
        for (var i = 0; i < selection.length; i++) {
            selection[i].addTag(tag);
        }
        window.app.emit('app:changed');
    });

    // app.on('app:select-line', this.selectLines.bind(self));
    var toggleBound = this.toggle.bind(this);
    app.on('app:loading', function() { $(".toggle-select-mode").off('click', toggleBound); });
    app.on('app:loaded', function() { $(".toggle-select-mode").on('click', toggleBound); });
};
function WaitingAnimation(opts) {
    for (key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}
WaitingAnimation.prototype.render = function() {
    window.app.on('app:loading', this.start.bind(this));
    window.app.on('app:loaded', this.stop.bind(this));
    window.app.on('app:ajaxError', this.stop.bind(this));
    this.glyphs = [];
    for (var i = 0; i <  this.model.items.length; i++) {
        for (var j = 0 ; j < this.model.items[i].sample.length; j++) {
            this.glyphs.push(this.model.items[i].sample[j]);
        }
    }
};

WaitingAnimation.prototype.stop = function stopWaitingAnimation() {
    this.$el.addClass('hidden');
    this.$el.empty();
    clearInterval(this.animationId);
    clearTimeout(this.timeoutId);
};

WaitingAnimation.prototype.start = function startWaitingAnimation() {
    var self = this;
    this.$el.removeClass('hidden');
    this.animationId = setInterval(function() {
        perRound = window.app.settings.animationsPerRound;
        while (perRound-- > 0) {
            $(self.glyphs[parseInt(Math.random() * self.glyphs.length)])
                .css('top', parseInt(Math.random() * 100) + "vh")
                .css('left', parseInt(Math.random() * 100) + "vw")
                .appendTo(self.$el) ;
        }
    }, window.app.settings.animationInterval);
    this.timeoutId = setTimeout(function timeoutAnimation() {
        console.error("Animation ran too long, stopping it");
        notie.alert(3, "Loading took more than " +
                    (window.app.settings.animationTimeout / 1000) +
                    " seconds. Please see the console for possible errors");
        clearInterval(self.animationId);
    }, window.app.settings.animationTimeout);
};
// Name: ocr-gt-tools.js

$(function onPageLoaded() {
    var app = window.app = new App();
    app.on('app:initialized', function onInit() {
        console.info("Initialized ocr-gt app.");
    });
    app.init();
});
