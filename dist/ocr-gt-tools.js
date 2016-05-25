/********************/
/* Utiliy functions */
/********************/

var Utils = {};
/**
 * Transform text file to array of line lineComments
 *
 * @param {string} txt Contents of the text file
 * @param {object} target the object to attach 'pageComment'/'lineComments' to
 */
Utils.parseLineComments = function parseLineComments(txt, target) {
    var lines = txt.split(/\n/);
    var lineComments = [];
    for (var i = 0; i < lines.length ; i++) {
        var lineComment = lines[i].replace(/^\d+:\s*/, '');
        lineComment = Utils.encodeForServer(lineComment);
        lineComments.push(lineComment);
    }
    target.pageComment = lineComments[0];
    target.lineComments = lineComments.slice(1);
};

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
 * Attach current UNIX time as a URL parameter to a URL so a GET request to it
 * won't be cached.
 *
 * @param {string} url the URL to timestamp
 */
Utils.uncachedURL = function uncachedURL(url) {
    return url + "?nocache=" + Date.now();
};

/**
 * Test whether element is within viewport
 * No jQuery necessary.
 * Thanks to Dan's StackOverflow answer for this:
 * http://stackoverflow.com/questions/123999/how-to-tell-if-a-dom-element-is-visible-in-the-current-viewport
*/
Utils.isElementInViewport = function isElementInViewport(el) {
    var rect = el.getBoundingClientRect();
    return (rect.top >= 0 && rect.left >= 0);
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

Utils.encodeForServer = function encodeForServer(str) {
    if (typeof str === 'undefined') {
        return '';
    }
    return str
        .replace(/^(<br[^>]*>)*/, '')
        .replace(/(<br[^>]*>)*$/, '')
        .replace(/<br[^>]*>/g, "\n");
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
function compileTemplates() {
    var templates = {};
    $("*[id^='tpl-']").each(function() {
        var $this = $(this);
        var tplId = $this.attr('id').replace(/^tpl-/, '');
        templates[tplId] = Handlebars.compile($this.html());
    });
    return templates;
}
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
var UISettings = {
    zoomInFactor: 1.4,
    zoomOutFactor: 0.8,
    cgiUrl: 'ocr-gt-tools.cgi',
    defaultViews: ['.transcription','img']
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
                self.items.push(data[keys[i]]);
            }
            cb();
        },
    });
};

function Page(urlOrOpts) {
    if (typeof urlOrOpts === 'string') {
        this.imageUrl = urlOrOpts;
    } else {
        this.imageUrl = urlOrOpts.imageUrl;
        for (key in urlOrOpts) { this[key] = urlOrOpts[key]; }
    }
    this.changed = false;
}

Page.prototype.save = function(cb) {
    if (!this.changed) {
        notie.alert(2, "Nothing changed.", 1);
        return;
    }
    $("#wait_save").addClass("wait").removeClass("hidden");
    $("#disk").addClass("hidden");
    this['line-transcriptions'] = $('li.transcription div').map(function() {
        return Utils.encodeForServer($(this).html());
    }).get();
    this['line-comments'] = $("li.line-comment div").map(function() {
        return Utils.encodeForServer($(this).html());
    }).get();
    this['page-comment'] = Utils.encodeForServer($("#page-comment div").html());
    // console.log(window.app.currentPage.pageComment);
    // console.log(window.app.currentPage.transcriptions);
    // console.log(window.app.currentPage.lineComments);

    $.ajax({
        type: 'POST',
        url: 'ocr-gt-tools.cgi?action=save',
        data: this.toJSON(),
        error: cb,
        success: function() {
            cb();
        },
    });
};

Page.prototype.toJSON = function() {
    var ret = {};
    ret.ids                    = this.ids;
    ret.url                    = this.url;
    ret['line-comments']       = this['line-comments'];
    ret['page-comment']        = this['page-comment'];
    ret['line-transcriptions'] = this['line-transcriptions'];
    return ret;
};

Page.prototype.load = function(cb) {
    var self = this;
    $.ajax({
        type: 'GET',
        url: 'ocr-gt-tools.cgi?action=create&imageUrl=' + this.imageUrl,
        error: cb,
        success: function(res) {
            console.log(res);
            for (key in res) { self[key] = res[key]; }
            cb();
        },
    });
};
function PageView(opts) {
    for (key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}
PageView.prototype.render = function() {
    console.log(this.model);
    for (var i = 0; i < this.model['line-transcriptions'].length; i++)  {
        var line = {
            transcription: this.model['line-transcriptions']
        };
        var $line = $(this.tpl(line));
        $line.find(":checkbox").on('click', function(e) {
            $(this).closest('.row').toggleClass('selected');
            e.stopPropagation();
        });
        $line.find(".select-col").on('click', function(e) {
            $(this).find(':checkbox').click();
        });
        $line.find(".transcription div[contenteditable]").on('keydown', function(e) {
            if (e.keyCode == 13) {
                e.preventDefault();
            }
        });
        $line.find("div[contenteditable]").on('blur', function(e) {
            $(this).html(Utils.encodeForBrowser(Utils.encodeForServer($(this).html())));
        });
        this.$el.append($line);
    }
};
function Dropzone() {
}
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
        notie.alert(1, "In Zwischenablage kopiert: '" + $(this).attr('data-clipboard-text') + "'");
    });
    self.$el.find('input[type="text"]').on('keydown', function(e) {
        self.filter = (e.keyCode < 32 || e.ctrlKey || e.altKey) ?  null : String.fromCharCode(e.keyCode);
        self.applyFilter();
        $(this).val('');
    });
    return self;
};
function WaitingAnimation(opts) {
    for (key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}
WaitingAnimation.prototype.stop = function stopWaitingAnimation() {
    this.$el.addClass('hidden');
    clearInterval(this._id);
};
WaitingAnimation.prototype.start = function startWaitingAnimation() {
    var self = this;
    this.$el.removeClass('hidden');
    var items = self.model.items;
    this._id = setInterval(function() {
        perRound = 5;
        while (perRound-- > 0) {
            var randGlyph = items[parseInt(Math.random() * items.length)];
            $(self.el +
              " tr:nth-child(" + parseInt(Math.random() * 20) + ")" +
              " td:nth-child(" + parseInt(Math.random() * 20) + ")"
             ).html(randGlyph.sample);
        }
    }, 300);
};
// Name: ocr-gt-tools.js

function httpError(xhr) {
    notie.alert(3, "HTTP Fehler " + xhr.status + ":\n<pre style='text-align: left'>" + xhr.responseText + "</pre>");
    window.app.waitingAnimation.stop();
};

/*******************************/
/* Client-Server communication */
/*******************************/

/**
 * Loads a URL for editing.
 *
 * @param {string} url The image URL to load
 */
function loadGtEditLocation(url) {

    if (!url) {
        return;
    }

    $.ajax({
        type: 'GET',
        url: UISettings.cgiUrl + '?action=create&imageUrl=' + url,
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
        error: httpError,
    });
}

/**
 * When the document should be saved back to the server.
 *
 */
function saveGtEditLocation() {

    if (!window.app.currentPage.changed) {
        notie.alert(2, "Nothing changed.", 1);
        return;
    }

    $("#wait_save").addClass("wait").removeClass("hidden");
    $("#disk").addClass("hidden");
    window.app.currentPage.transcriptions = $('li.transcription div').map(function() {
        return Utils.encodeForServer($(this).html());
    }).get();
    window.app.currentPage.lineComments = $("li.line-comment div").map(function() {
        return Utils.encodeForServer($(this).html());
    }).get();
    window.app.currentPage.pageComment = Utils.encodeForServer($("#page-comment div").html());
    // console.log(window.app.currentPage.pageComment);
    // console.log(window.app.currentPage.transcriptions);
    // console.log(window.app.currentPage.lineComments);

    $.ajax({
        type: 'POST',
        url: UISettings.cgiUrl + '?action=save',
        data: window.app.currentPage,
        success: markSaved,
        error: httpError,
    });
}

/********************/
/* DOM manipulation */
/********************/


/**
 * Mark the current page as 'changed'.
 */
function markChanged() {
    window.app.currentPage.changed = true;
    $("#save_button").removeClass("disabled");
    updateCommentButtonColor();
}

/**
 * Mark the current page as 'saved'.
 */
function markSaved() {
    window.app.currentPage.changed = false;
    $("#wait_save").removeClass("wait").addClass("hidden");
    $("#disk").removeClass("hidden");
    $("#save_button").addClass("disabled");
    $(".line div[contenteditable]").each(function() {
        $(this).html(Utils.encodeForBrowser(Utils.encodeForServer($(this).html())));
    });
    notie.alert(1, "Gespeichert", 1);
}

/**
 * Adds comment fields
 */
function addCommentFields() {
    $("#file-correction").empty();
    $("#raw-html table").each(function(curLine) {
        var $this = $(this);
        var line = {
            "id": curLine,
            "title": $this.find("td")[0].innerHTML,
            "imgSrc": $this.find("img")[0].getAttribute('src'),
            "transcription": Utils.encodeForBrowser($this.find("td")[2].innerHTML),
            "comment": Utils.encodeForBrowser(window.app.currentPage.lineComments[curLine]),
        };
        var $line = $(window.app.templates.line(line));
        $(":checkbox", $line).on('click', function(e) {
            $(this).closest('.row').toggleClass('selected');
            e.stopPropagation();
        });
        $(".select-col", $line).on('click', function(e) {
            $(this).find(':checkbox').click();
        });
        $(".transcription div[contenteditable]", $line).on('keydown', function(e) {
            if (e.keyCode == 13) {
                e.preventDefault();
            }
        });
        $("div[contenteditable]", $line).on('blur', function(e) {
            $(this).html(Utils.encodeForBrowser(Utils.encodeForServer($(this).html())));
        });
        $("#file-correction").append($line);
    });
    $("#right-sidebar").html(window.app.templates.rightSidebar(window.app.currentPage));
    $(".show-line-comment").on('click', toggleLineComment);
    $(".hide-line-comment").on('click', toggleLineComment);
    $(".add-comment").on('click', addComment);
    updateCommentButtonColor();
    reduceViewToSelectors(UISettings.defaultViews);
}

/**
 * Increase image zoom by UISettings.zoomInFactor
 */
function zoomIn(e) {
    e.stopPropagation();
    $('#file-correction img').each(function() {
        Utils.scaleHeight(this, UISettings.zoomInFactor);
    });
}

/**
 * Decrease image zoom by UISettings.zoomOutFactor
 */
function zoomOut(e) {
    e.stopPropagation();
    $('#file-correction img').each(function() {
        Utils.scaleHeight(this, UISettings.zoomOutFactor);
    });
}

/**
 * Reset all images to their original size
 */
function zoomReset(e) {
    e.stopPropagation();
    $('#file-correction img').each(function() {
        Utils.scaleHeight(this, 1);
    });
}

/**
 * Update the color of the comment toggle button depending on whether line has
 * comments or not.
 */
function updateCommentButtonColor() {
    $(".line").each(function() {
        var $line = (this);
        var $lineComment = $(".line-comment div[contenteditable]", $line);
        var lineCommentId = $(".line-comment", $line).attr('id');
        if ($lineComment.text().match(/\S/)) {
            $(".show-line-comment[data-target='#" + lineCommentId + "']").removeClass('btn-default').addClass('btn-info');
        } else {
            $(".show-line-comment[data-target='#" + lineCommentId + "']").addClass('btn-default').removeClass('btn-info');
        }
    });
}

/**
 * Show/hide the line comments for a particular line
 */
function toggleLineComment() {
    var target = $(this).attr('data-target');
    $(target).toggleClass("view-hidden");
    $("*[data-target='#" + target + "']").toggleClass("hidden");
}

function addMultiComment() {
    var tag = '#' + $(this).attr('data-tag');
    $('.selected .line-comment').each(function() {
        addTagToElement($("div[contenteditable]", $(this)), tag);
    });
}

function addComment() {
    var target = $($(this).attr('data-target')).find('div[contenteditable]');
    var tag = '#' + $(this).attr('data-tag');
    addTagToElement($(target), tag);
}

function addTagToElement($target, tag) {
    $target.html($target.html().trim());
    if ($target.html().indexOf(tag) == -1) {
        if ($target.html().match(/\S/)) {
            $target.append('\n');
        }
        $target.append(tag);
        $target.append('\n');
        $target.parent().removeClass("hidden");
        markChanged();
    }
}

/**
 * Sort the rows by image width
 *
 * @param {number} order Sort descending (-1) or ascending (1, default)
 */
function sortRowsByWidth(order) {
    var order = order || 1;
    $("#file-correction").append(
        $("#file-correction .row").sort(function(a, b) {
            var aWidth = Utils.getImageWidth(a);
            var bWidth = Utils.getImageWidth(b);
            return (aWidth - bWidth) * order;
        }).detach()
    );
}

/**
 * Sort the rows by line number
 *
 * @param {number} order Sort descending (-1) or ascending (1, default)
 */
function sortRowsByLine(order) {
    var order = order || 1;
    $("#file-correction").append(
        $("#file-correction .row").sort(function(a, b) {
            var aLine = $(a).attr('id').replace(/[^\d]/g, '');
            var bLine = $(b).attr('id').replace(/[^\d]/g, '');
            return (aLine - bLine) * order;
        }).detach()
    );
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

function reduceViewToSelectors(selectors) {
    $(".lines-col .panel *").addClass('view-hidden');
    for (var i = 0; i < selectors.length; i++) {
        $(selectors[i])
            .removeClass('view-hidden')
            .parents().removeClass('view-hidden');
    }
}

/******************/
/* Event handlers */
/******************/

function confirmExit(e) {
    if (window.app.currentPage && window.app.currentPage.changed) {
        // if (e) e.preventDefault();
        notie.alert(2, "Ungesicherte Inhalte vorhanden, bitte zuerst speichern!", 5);
        return "Ungesicherte Inhalte vorhanden, bitte zuerst speichern!";
    }
}

function onHashChange() {
    var cHash = window.location.hash;

    if (window.app.currentPage && window.app.currentPage.changed) {
        confirmExit();
    } else if (cHash === '') {
        return;
    }
    window.app.loadPage(cHash.substring(1));
}

function onScroll() {
    var done = false;
    var cur = 0;
    var total = 0;
    $("table").each(function() {
        total += 1;
        if (done) {
            return;
        }
        if (Utils.isElementInViewport(this)) {
            cur = 1 + parseInt(this.getAttribute('data-line-number'));
            done = true;
        }
    });
    $("#currentLine").html(cur + ' / ' + total);
}

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
                    loadGtEditLocation(url);
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

$(function onPageLoaded() {
    var app = window.app = new App();
    window.onhashchange = onHashChange;
    window.onbeforeunload = confirmExit;
    window.onscroll = onScroll;

    // Setup event handlers for drag and drop
    setupDragAndDrop();
    // Trigger hash change
    app.$el.on('app:initialized', function() {
        notie.alert(1, "App geladen", 1);
        app.render();
        onHashChange();
    });
    app.init();
});



// vim: sw=4 ts=4 fmr={,} :
