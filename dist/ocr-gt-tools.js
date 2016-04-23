// Name: ocr-gt-tools.js

var UISettings = {
    zoomInFactor: 1.4,
    zoomOutFactor: 0.8,
    cgiUrl: 'ocr-gt-tools.cgi'
};
console.log(UISettings.cgiUrl);
console.log(UISettings.cgiUrl + '?action=save');

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

    $("#wait_load").removeClass("hidden");
    $('#file_name').html(url);
    $('#file_image').html('<img src=' + url + '>');

    $.ajax({
        type: 'POST',
        url: UISettings.cgiUrl + '?action=create',
        data: {'data_url': url},
        beforeSend: function(xhr) {
            // to instantly see when a new document has been retrieved
            $("#file_correction").addClass("hidden");
        },
        success: function(res) {
            // file correction will be loaded
            window.ocrGtLocation = res;
            window.location.hash = window.ocrGtLocation.imageUrl;
            $("#file_correction").load(
                Utils.uncachedURL(window.ocrGtLocation.correctionUrl),
                handleCorrectionAjax);
            // Zoom buttons only for non-IE
            $("#zoom_button_plus").removeClass("hidden");
            $("#zoom_button_minus").removeClass("hidden");
            $("#save_button").removeClass("hidden");
            // activate button if #file_correction is changed

            // Add links to downloads to the DOM
            $("#file_links").html(
                "<div id='file_rem'><a download href='" + res.commentsUrl + "' target='_blank'>anmerkungen.txt</a></div>" +
                "<div id='file_o_rem'><a download href='" + res.correctionUrl + "' target='_blank'>correction.html</a></div>");

        },
        error: function(x, e) {
            window.alert(x.status + " FEHLER aufgetreten: \n" + e);
        }
    });
}

/**
 * Handle a $load completion event.
 *
 * @param {object} response
 * @param {string} status
 * @param {object} xhr
 *
 */
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
            $("#wait_load").addClass("hidden");
            // show new document
            $("#file_correction").removeClass("hidden");
            // make lines as wide as the widest line
            normalizeInputLengths();
            onScroll();
        }
    });
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
    window.ocrGtLocation.transliterations = $('tr:nth-child(3n) td:nth-child(1)').map(function() {
        return $(this).html();
    }).get();
    window.ocrGtLocation.lineComments = $(".lineComment > td").map(function() {
        return $(this).html();
    }).get();
    console.log(window.ocrGtLocation.lineComments);
    window.ocrGtLocation.pageComment = $(".pageComment").html();

    $.ajax({
        type: 'post',
        url: UISettings.cgiUrl + '?action=save',
        data: window.ocrGtLocation,
        success: function() {
            // after #file_correction is saved
            window.ocrGtLocation.changed = false;
            $("#wait_save").removeClass("wait").addClass("hidden");
            $("#disk").removeClass("hidden");
            $("#save_button").addClass("inaktiv").removeClass("aktiv");
        },
        error: function(x, e) {
            window.alert(x.status + " FEHLER aufgetreten");
        }
    });
}

/********************/
/* DOM manipulation */
/********************/

/**
 * Set the width of every 'contenteditable' element to the
 * width of the widest 'contenteditable' element.
 */
function normalizeInputLengths() {
    var maxWidth = 0;
    $("img").each(function() {
        maxWidth = Math.max(maxWidth, this.offsetWidth);
    });
    console.log(maxWidth);
    $("*[contenteditable]").css('width', maxWidth);
}

/**
 * Adds comment fields
 */
function addCommentFields() {
    $("td[contenteditable][spellcheck]").each(function(curLine) {
        var curComment = window.ocrGtLocation.lineComments[curLine];
        $(this)
        .parent('tr').append(
            $('<td>')
            .append($('<span class="lineCommentOpen "><i class="fa fa-commenting-o"></i></span>')
                    .toggleClass('hidden', curComment !== ''))
            .append($('<span class="lineCommentClosed "><i class="fa fa-map-o"></i></span>')
                    .toggleClass('hidden', curComment === ''))
            .on('click tap', function() { toggleLineComment($(this).parent('tr').next()); })
        ).closest('table')
            .attr('data-line-number', curLine)
            .append(
                $('<tr class="lineComment">' +
                    '<td contenteditable>' +
                        curComment         +
                    '</td>'                +
                '</tr>').toggleClass('hidden', curComment === '')
            );
    });
    $("#file_correction").prepend(
        '<div class="pageComment" contenteditable>' +
            window.ocrGtLocation.pageComment +
        '</div>'
    );
}

/**
 * Increase zoom by UISettings.zoomInFactor
 */
function zoomIn() {
    $('#file_correction img').each(function() {
        Utils.scaleHeight(this, UISettings.zoomInFactor);
    });
}

/**
 * Decrease zoom by UISettings.zoomOutFactor
 */
function zoomOut() {
    $('#file_correction img').each(function() {
        Utils.scaleHeight(this, UISettings.zoomOutFactor);
    });
}

/**
 * Reset all images to their original size
 */
function zoomReset() {
    $('#file_correction img').each(function() {
        Utils.scaleHeight(this, 1);
    });
}

/**
 * Show/hide the line comments for a particular row
 */
function toggleLineComment($tr) {
    $tr.toggleClass("hidden");
    var $prevTr = $tr.prev();
    $("span.lineCommentOpen", $prevTr).toggleClass("hidden");
    $("span.lineCommentClosed", $prevTr).toggleClass("hidden");
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

function onDrop(e) {
    e.preventDefault();

    if (window.ocrGtLocation && window.ocrGtLocation.changed) {
        window.alert("Ungesicherte Inhalte vorhanden, bitte zuerst speichern!");
    } else {
        var dropped = e.originalEvent.dataTransfer.getData('text/html');
        var url = $(dropped).find('img').addBack('img').attr('src');
        if (!url) {
            url = $(dropped).find('a').addBack('a').attr('href');
        }
        if (!url) {
            url = e.originalEvent.dataTransfer.getData('text/plain');
        }
        if (url) {
            loadGtEditLocation(url);
        } else {
            window.alert("Konnte keine URL erkennen.");
        }
    }
}

/**
 *
 */
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

$(function onPageLoaded() {
    window.onhashchange = onHashChange;
    window.onbeforeunload = confirmExit;
    window.onscroll = onScroll;
    $(document).bind('drop dragover', function(e) {
        // Prevent the default browser drop action:
        e.preventDefault();
    });
    $(document).bind('drop', onDrop);
    // event listeners
    $("#save_button").on("click", saveGtEditLocation);
    $("#zoom_button_plus").on("click", zoomIn);
    $("#zoom_button_minus").on("click", zoomOut);
    $("#zoom_button_reset").on("click", zoomReset);
    $("#file_correction").on('input', function onInput() {
        //window.alert("input event fired");
        $("#save_button").removeClass("inaktiv").addClass("aktiv");
        window.ocrGtLocation.changed = true;
    });
    $("#expand_all_comments").on("click", function onClickExpand() {
        $("tr.lineComment").removeClass('hidden');
        onScroll();
    });
    $("#collapse_all_comments").on("click", function onClickCollapse() {
        $("tr.lineComment").addClass('hidden');
        onScroll();
    });
    onHashChange();
});



// vim: sw=4 ts=4 fdm=syntax:
