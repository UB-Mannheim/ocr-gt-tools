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
Utils.fitHeight = function expandTextarea(selector) {
    $(selector).each(function() {
        $(this)
            .attr('rows', 1) // Must be one for single-line textareas
            .css({'height': 'auto', 'overflow-y': 'hidden', 'resize': 'none'})
            .height(this.scrollHeight);
    });
};
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

function Page(urlOrOpts) {
    this.lines = [];
    if (typeof urlOrOpts === 'string') {
        this.imageUrl = urlOrOpts;
    } else {
        this.imageUrl = urlOrOpts.imageUrl;
        for (key in urlOrOpts) { this[key] = urlOrOpts[key]; }
    }
    this.changed = false;
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
    this.selected = false;
}

function PageView(opts) {
    for (var key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
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
    this.$el.empty();
    // render lines
    for (var i = 0; i < this.model.lines.length; i++)  {
        var lineView = new LineView({
            "model": this.model.lines[i],
        });
        lineView.render();
        this.$el.append(lineView.$el);
    }
    window.app.on('app:loaded', function fitTextareaSize() { Utils.fitHeight('textarea'); });
};
function LineView(opts) {
    for (key in opts) { this[key] = opts[key]; }
}


// TODO
function addComment() {
    var target = $($(this).attr('data-target')).find('div[contenteditable]');
    var tag = '#' + $(this).attr('data-tag');
    addTagToElement($(target), tag);
}

// TODO
function addTagToElement($target, tag) {
    $target.html($target.html().trim());
    if ($target.html().indexOf(tag) == -1) {
        if ($target.html().match(/\S/)) {
            $target.append('\n');
        }
        $target.append(tag);
        $target.append('\n');
        $target.parent().removeClass("hidden");
        window.app.emit('app:changed');
    }
}

/**
 * Update the color of the comment toggle button depending on whether line has
 * comments or not.
 */
LineView.prototype.updateCommentButtonColor = function updateCommentButtonColor() {
    var toggler = this.$el.find(".toggle-line-comment");
    if (this.model.comment.length > 0)
        toggler.removeClass('btn-default').addClass('btn-info');
    else
        toggler.addClass('btn-default').removeClass('btn-info');
};

LineView.prototype.render = function() {
    var self = this;
    // Build from template
    this.$el = $(window.app.templates.line(this.model));

    // updateCommentButtonColor
    window.app.on('app:changed', this.updateCommentButtonColor.bind(this));
    this.updateCommentButtonColor();

    this.$el.find(".toggle-line-comment").on('click', function() {
        self.$el.find(".line-comment").toggleClass("view-hidden");
        self.$el.find(".toggle-line-comment").toggleClass("hidden");
    });

    this.$el.find("input,textarea").on('input', function(e) {
        self.model.comment = self.$el.find('.line-comment textarea').val().trim();
        self.model.transcription = self.$el.find('.line-transcription input').val().trim();
        Utils.fitHeight(this);
        window.app.emit('app:changed');
    });

    this.$el.find(":checkbox").on('click', function(e) {
        if (!window.app.selectMode) return;
        $(this).closest('.row').toggleClass('selected');
        e.stopPropagation();
    });
    this.$el.on('click', function(e) {
        if (!window.app.selectMode) return;
        $(this).find(':checkbox').click();
    });
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

function Dropzone(opts) {
    for (var key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}
Dropzone.prototype.render = function() {
    var self = this;
    window.app.on('app:loading', function hideDropzone() { self.$el.addClass('hidden'); });
};
function Toolbar(opts) {
    for (key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}
/**
 * Increase image zoom by UISettings.zoomInFactor
 */
Toolbar.prototype.zoomIn = function(e) {
    e.stopPropagation();
    $('#file-correction img').each(function() {
        Utils.scaleHeight(this, UISettings.zoomInFactor);
    });
};

/**
 * Decrease image zoom by UISettings.zoomOutFactor
 */
Toolbar.prototype.zoomOut = function zoomOut(e) {
    e.stopPropagation();
    $('#file-correction img').each(function() {
        Utils.scaleHeight(this, UISettings.zoomOutFactor);
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

Toolbar.prototype.reduceViewToSelectors = function reduceViewToSelectors(selectors) {
    $(".lines-col .panel *").addClass('view-hidden');
    for (var i = 0; i < selectors.length; i++) {
        $(selectors[i])
            .removeClass('view-hidden')
            .parents().removeClass('view-hidden');
    }
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
    $(".set-view").on('click', function() {
        self.reduceViewToSelectors($(this).attr('data-target').split(/\s*,\s*/));
    });

    // Handle sorting
    $("#sort-line").on('click', function() { app.pageView.sortRowsByLine(1); });
    $("#sort-line-desc").on('click', function() { app.pageView.sortRowsByLine(-1); });
    $("#sort-width").on('click', function() { app.pageView.sortRowsByWidth(1); });
    $("#sort-width-desc").on('click', function() { app.pageView.sortRowsByWidth(-1); });

    // Select Mode
    $("#toggle-select").on('click', app.toggleSelectMode.bind(app));
    $("#select-bar .close").on('click', app.toggleSelectMode.bind(app));

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
        notie.alert(1, "In Zwischenablage kopiert: '" + $(this).attr('data-clipboard-text') + "'");
    });
    self.$el.find('input[type="text"]').on('keydown', function(e) {
        self.filter = (e.keyCode < 32 || e.ctrlKey || e.altKey) ?  null : String.fromCharCode(e.keyCode);
        self.applyFilter();
        $(this).val('');
    });
    return self;
};
// Name: ocr-gt-tools.js

$(function onPageLoaded() {
    var app = window.app = new App();
    app.on('app:initialized', function onInit() {
        notie.alert(1, "App geladen", 1);
    });
    app.init();
});
