// Name: ocr-gt-tools.js

var UISettings = {
    zoomInFactor: 1.4,
    zoomOutFactor: 0.8,
    cgiUrl: '../ocr-gt-tools.cgi'
};

var Utils = {};

/********************/
/* Utiliy functions */
/********************/

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
        lineComment = unescapeNewline(lineComment);
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
function isElementInViewport(el) {
    var rect = el.getBoundingClientRect();
    return (rect.top >= 0 && rect.left >= 0);
}

/**
 * Compile the Handlebars templates
 */

function compileTemplates() {
    window.templates = {};
    $("*[id^='tpl-']").each(function() {
        var $this = $(this);
        var tplId = $this.attr('id').replace(/^tpl-/, '');
        window.templates[tplId] = Handlebars.compile($this.html());
    });
}


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
        type: 'POST',
        url: UISettings.cgiUrl + '?action=create',
        data: {'data_url': url},
        beforeSend: function(xhr) {
            // to instantly see when a new document has been retrieved
            $("#file-correction").addClass("hidden");
        },
        success: function(res) {
            // file correction will be loaded
            $("#dropzone").addClass('hidden');
            window.ocrGtLocation = res;
            window.location.hash = window.ocrGtLocation.imageUrl;
            $("#raw-html").load(
                Utils.uncachedURL(window.ocrGtLocation.correctionUrl),
                function handleCorrectionAjax(response, status, xhr) {
                    $.ajax({
                        type: 'GET',
                        url: Utils.uncachedURL(window.ocrGtLocation.commentsUrl),
                        error: function(x, e) {
                            window.alert(x.status + " FEHLER aufgetreten: \n" + e);
                        },
                        success: function(response, status, xhr) {
                            Utils.parseLineComments(response, window.ocrGtLocation);
                            addCommentFields();
                            // hide waiting spinner
                            // $("#wait-load").addClass("hidden");
                            // show new document
                            $("#file-correction").removeClass("hidden");
                            onScroll();
                        }
                    });
                }
            );
            // Zoom buttons only for non-IE
            $("#zoom-in").removeClass("hidden");
            $("#zoom-out").removeClass("hidden");
            $("#save_button").removeClass("hidden");
            // activate button if #file-correction is changed
        },
        error: function(x, e) {
            window.alert(x.status + " FEHLER aufgetreten: \n" + e);
        }
    });
}

function escapeNewline(str) {
    return str.replace(/^\n*/, '').replace(/\n*$/, '').replace(/\n/g, '<br>');
}

function unescapeNewline(str) {
    return str.replace(/^(<br>)*/, '').replace(/(<br>)*$/, '').replace(/<br>/g, "\n");
}

function markChanged() {
    window.ocrGtLocation.changed = true;
    $("#save_button").removeClass("disabled");
    updateCommentButtonColor();
}

function markSaved() {
    window.ocrGtLocation.changed = false;
    $("#wait_save").removeClass("wait").addClass("hidden");
    $("#disk").removeClass("hidden");
    $("#save_button").addClass("disabled");
}

/**
 * When the document should be saved back to the server.
 *
 */
function saveGtEditLocation() {

    if (!window.ocrGtLocation.changed) {
        console.log("Nothing changed.");
        return;
    }

    $("#wait_save").addClass("wait").removeClass("hidden");
    $("#disk").addClass("hidden");
    window.ocrGtLocation.transliterations = $('li.transcription div').map(function() {
        return escapeNewline($(this).html());
    }).get();
    window.ocrGtLocation.lineComments = $("li.line-comment div").map(function() {
        return escapeNewline($(this).html());
    }).get();
    window.ocrGtLocation.pageComment = escapeNewline($(".page-comment div").html());
    console.log(window.ocrGtLocation.pageComment);
    console.log(window.ocrGtLocation.transliterations);
    console.log(window.ocrGtLocation.lineComments);

    $.ajax({
        type: 'post',
        url: UISettings.cgiUrl + '?action=save',
        data: window.ocrGtLocation,
        success: markSaved,
        error: function(x, e) {
            window.alert(x.status + " FEHLER aufgetreten");
        }
    });
}

/********************/
/* DOM manipulation */
/********************/

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
            "transcription": unescapeNewline($this.find("td")[2].innerHTML),
            "comment": unescapeNewline(window.ocrGtLocation.lineComments[curLine]),
        };
        var $line = $(window.templates.line(line));
        $(":checkbox", $line).on('change', function() {
            $(this).closest('.row').toggleClass('selected');
        });
        $("#file-correction").append($line);
    });
    $("#page-info").html(window.templates.page(window.ocrGtLocation));
    $("#wait-load").removeClass("hidden");
    $(".show-line-comment").on('click', toggleLineComment);
    $(".hide-line-comment").on('click', toggleLineComment);
    $(".add-comment").on('click', addComment);
    updateCommentButtonColor();
}

/**
 * Increase zoom by UISettings.zoomInFactor
 */
function zoomIn(e) {
    e.stopPropagation();
    $('#file-correction img').each(function() {
        Utils.scaleHeight(this, UISettings.zoomInFactor);
    });
}

/**
 * Decrease zoom by UISettings.zoomOutFactor
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
 * Update the color of the comment toggle button depending on whether it has
 * comments or not.
 */
function updateCommentButtonColor() {
    $(".line").each(function() {
        var $line = (this);
        var $lineComment = $(".line-comment div[contenteditable]", $line);
        if ($lineComment.html().match(/\S/)) {
            $(".show-line-comment", $line).removeClass('btn-default').addClass('btn-info');
        } else {
            $(".show-line-comment", $line).addClass('btn-default').removeClass('btn-info');
        }
    });
}

/**
 * Show/hide the line comments for a particular line
 */
function toggleLineComment() {
    var target = $(this).attr('data-target');
    $(target).toggleClass("hidden");
    $("*[data-target='#" + target + "']").toggleClass("hidden");
}
function hideLineComment() {
    var target = $(this).attr('data-target');
    $(target).addClass("hidden");
    $(".hide-line-class[data-target='#" + target + "']").addClass('hidden');
    $(".show-line-class[data-target='#" + target + "']").removeClass('hidden');
}
function hideAllLineComments() {
    $(".hide-line-comment").each(hideLineComment);
    onScroll();
}
function showLineComment() {
    var target = $(this).attr('data-target');
    $(target).removeClass("hidden");
    $(".hide-line-class[data-target='#" + target + "']").removeClass('hidden');
    $(".show-line-class[data-target='#" + target + "']").addClass('hidden');
}
function showAllLineComments() {
    $(".show-line-comment").each(showLineComment);
    onScroll();
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
    if ($target.html().indexOf(tag) == -1) {
        if ($target.html().match(/^.*\S.*$/)) {
            $target.append('\n');
        }
        $target.append(tag);
        $target.append('\n');
        markChanged();
    }
}

/******************/
/* Event handlers */
/******************/

function confirmExit(e) {
    if (window.ocrGtLocation && window.ocrGtLocation.changed) {
        // if (e) e.preventDefault();
        window.alert("Ungesicherte Inhalte vorhanden, bitte zuerst speichern!");
        return "Ungesicherte Inhalte vorhanden, bitte zuerst speichern!";
    }
}

function onHashChange() {
    var cHash = window.location.hash;

    if (window.ocrGtLocation && window.ocrGtLocation.changed) {
        confirmExit();
    } else {
        if (cHash !== '') {
            loadGtEditLocation(cHash.substring(1));
        }
    }
}

function getUrlFromDragEvent(e) {
    var elem = e.originalEvent.dataTransfer.getData('text/html');
    var url = $(elem).find('img').addBack('img').attr('src');
    if (!url) {
        url = $(elem).find('a').addBack('a').attr('href');
    }
    if (!url) {
        url = e.originalEvent.dataTransfer.getData('text/plain');
    }
    return url;
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
        if (isElementInViewport(this)) {
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
    $(document).bind('dragenter', function onDragEnter(e) {
        e.preventDefault();
        $("#dropzone").removeClass('hidden');
    });
    $(document).bind('dragend', function onDragEnd(e) {
        e.preventDefault();
        $("#dropzone").addClass('hidden');
    });
    $("#dropzone").bind('dragover', function onDragOver(e) {
        e.preventDefault();
        $("#dropzone").addClass('droppable').removeClass('hidden');
    });
    $("#dropzone").bind('dragenter', function onDragEnterDropZone(e) {
        e.preventDefault();
        e.stopPropagation();
        $("#dropzone").addClass('droppable').removeClass('hidden');
    });
    $("#dropzone").bind('dragleave', function onDragLeaveDropZone(e) {
        e.preventDefault();
        $("#dropzone").removeClass('droppable').addClass('hidden');
    });
    $("#dropzone").bind('drop', function onDrop(e) {
        e.preventDefault();

        if (window.ocrGtLocation && window.ocrGtLocation.changed) {
            window.alert("Ungesicherte Inhalte vorhanden, bitte zuerst speichern!");
        } else {
            var url = getUrlFromDragEvent(e);
            if (url) {
                loadGtEditLocation(url);
            } else {
                window.alert("Konnte keine URL erkennen.");
            }
        }
    });
}

function toggleSelectMode() {
    $(".selected").toggleClass('selected');
    $(".select-col").toggleClass('hidden');
    $("#select-bar").toggleClass('hidden');
}

$(function onPageLoaded() {
    compileTemplates();
    window.onhashchange = onHashChange;
    window.onbeforeunload = confirmExit;
    window.onscroll = onScroll;
    // Setup event handlers for drag and drop
    setupDragAndDrop();
    // event listeners
    $("#save_button").on("click", saveGtEditLocation);

    // Handle zooming
    $("#zoom-in").on("click", zoomIn);
    $("#zoom-out").on("click", zoomOut);
    $("#zoom-reset").on("click", zoomReset);

    // Notice changed input and make save button available
    $("#file-correction").on('input', markChanged);
    $("#page-info").on('input', markChanged);

    // Open history modal
    $('button[data-target="#history-modal"]').on('click', function() {
        $.ajax({
            url: UISettings.cgiUrl + '?action=history&mine=true',
            type: "json",
            success: function(data) {
                for (var i = 0; i < data.length ; i++) {
                    $("#history-modal tbody").append(window.templates.historyItem(data[i]));
                }
            },
            error: function(x, e) {
                window.alert(x.status + " FEHLER aufgetreten");
            }
        });
    });

    // Expand all comments
    $("#expand_all_comments").on("click", showAllLineComments);

    // Collapse all comments
    $("#collapse_all_comments").on("click", hideAllLineComments);

    // Select Mode
    $("#toggle-select").on('click', toggleSelectMode);
    $('.add-multi-comment').on('click', addMultiComment);

    $(".set-view").on('click', function() {
        $(".line *").addClass('view-hidden');
        var selectors = $(this).attr('data-target');
        $.each(selectors.split(/\s*,\s*/), function(idx, selector) {
            if (selector === '.line-comment') {
                showAllLineComments();
            }
            console.log(selector);
            $(selector).removeClass('view-hidden');
            $(selector).parents().removeClass('view-hidden');
        });
    });

    // Trigger hash change
    onHashChange();
});

// vim: sw=4 ts=4 :
