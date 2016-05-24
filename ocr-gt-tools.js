// Name: ocr-gt-tools.js

var UISettings = {
    zoomInFactor: 1.4,
    zoomOutFactor: 0.8,
    cgiUrl: 'ocr-gt-tools.cgi',
    defaultViews: ['.transcription','img']
};

function httpError(xhr) {
    notie.alert(3, "HTTP Fehler " + xhr.status + ":\n<pre style='text-align: left'>" + xhr.responseText + "</pre>");
    WaitingAnimation.stop();
};

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
        type: 'GET',
        url: UISettings.cgiUrl + '?action=create&imageUrl=' + url,
        beforeSend: function(xhr) {
            // to instantly see when a new document has been retrieved
            $("#file-correction").addClass("hidden");
            WaitingAnimation.start();
        },
        success: function(res) {
            // file correction will be loaded
            $("#dropzone").addClass('hidden');
            window.ocrGtLocation = res;
            console.log(window.ocrGtLocation);
            window.location.hash = window.ocrGtLocation.url['thumb-url'];
            window.setTimeout(function() {
                // ajax
                $("#raw-html").load(
                    Utils.uncachedURL(window.ocrGtLocation.url['correction-url']),
                    function handleCorrectionAjax(response, status, xhr) {
                        $.ajax({
                            type: 'GET',
                            url: Utils.uncachedURL(window.ocrGtLocation.url['comment-url']),
                            error: httpError,
                            success: function(response, status, xhr) {
                                Utils.parseLineComments(response, window.ocrGtLocation);
                                addCommentFields();
                                // show new document
                                $("#file-correction").removeClass("hidden");
                                $("ul.navbar-nav li").removeClass("disabled");
                                onScroll();
                                WaitingAnimation.stop();
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

    if (!window.ocrGtLocation.changed) {
        notie.alert(2, "Nothing changed.", 1);
        return;
    }

    $("#wait_save").addClass("wait").removeClass("hidden");
    $("#disk").addClass("hidden");
    window.ocrGtLocation.transcriptions = $('li.transcription div').map(function() {
        return Utils.encodeForServer($(this).html());
    }).get();
    window.ocrGtLocation.lineComments = $("li.line-comment div").map(function() {
        return Utils.encodeForServer($(this).html());
    }).get();
    window.ocrGtLocation.pageComment = Utils.encodeForServer($("#page-comment div").html());
    // console.log(window.ocrGtLocation.pageComment);
    // console.log(window.ocrGtLocation.transcriptions);
    // console.log(window.ocrGtLocation.lineComments);

    $.ajax({
        type: 'POST',
        url: UISettings.cgiUrl + '?action=save',
        data: window.ocrGtLocation,
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
    window.ocrGtLocation.changed = true;
    $("#save_button").removeClass("disabled");
    updateCommentButtonColor();
}

/**
 * Mark the current page as 'saved'.
 */
function markSaved() {
    window.ocrGtLocation.changed = false;
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
            "comment": Utils.encodeForBrowser(window.ocrGtLocation.lineComments[curLine]),
        };
        var $line = $(window.templates.line(line));
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
    $("#right-sidebar").html(window.templates.rightSidebar(window.ocrGtLocation));
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
    if (window.ocrGtLocation && window.ocrGtLocation.changed) {
        // if (e) e.preventDefault();
        notie.alert(2, "Ungesicherte Inhalte vorhanden, bitte zuerst speichern!", 5);
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

            if (window.ocrGtLocation && window.ocrGtLocation.changed) {
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

function onPageLoaded() {
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
    $("#right-sidebar").on('input', markChanged);

    // Open history modal
    $('button[data-target="#history-modal"]').on('click', function() {
        $.ajax({
            url: UISettings.cgiUrl + '?action=history&mine=true',
            dataType: "json",
            success: function(data) {
                for (var i = 0; i < data.length ; i++) {
                    $("#history-modal tbody").append(window.templates.historyItem(data[i]));
                }
            },
            error: httpError
        });
    });

    window.cheatsheetView = new CheatsheetView($("#cheatsheet-modal"), UISettings['special-chars']);
    window.cheatsheetView.render();

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

    new Clipboard('.code');
    // Trigger hash change
    onHashChange();
}

$(function() {
    $.ajax({
        type: 'GET',
        url: 'special-chars.json',
        dataType: "json",
        error: httpError,
        success: function(specialChars) {
            $.ajax({
                type: 'GET',
                url: 'error-tags.json',
                dataType: "json",
                error: function() {
                    Utils.httpE(x);
                },
                success: function(errorTags) {
                    UISettings['special-chars'] = specialChars;
                    UISettings['error-tags'] = errorTags;
                    onPageLoaded();
                },
            });
        },
    });
});

// vim: sw=4 ts=4 fmr={,} :
