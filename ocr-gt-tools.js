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
