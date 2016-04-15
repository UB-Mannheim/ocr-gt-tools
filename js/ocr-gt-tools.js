// Name: ocr-gt-tools.js

/**
 * Handle a $load completion event.
 *
 */
function handleCorrectionAjax(response, status, xhr) {
    $.ajax({
        type: 'GET',
        url: uncachedURL(window.ocrGtLocation.commentsUrl),
        error: function(x, e) {
            window.alert(x.status + " FEHLER aufgetreten: \n" + e);
        },
        success: function(response, status, xhr) {
            parseLineComments(response);
            addCommentFields(window.ocrGtLocation);
            // hide waiting spinner
            $("#wait_load").addClass("hidden");
            // hide line comments
            $("tr.lineComment").addClass("hidden");
            // show new document
            $("#file_correction").removeClass("hidden");
            normalizeInputLengths();
        }
    });
}

function normalizeInputLengths() {
    var maxWidth = 0;
    $("img").each(function() {
        maxWidth = Math.max(maxWidth, this.offsetWidth);
    });
    console.log(maxWidth);
    $("*[contenteditable]").css('width', maxWidth);
}

function uncachedURL(url) {
    return url + "?nocache=" + Date.now();
}

/**
 * When the document should be saved back to the server.
 *
 */
function onClickSave() {

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
        url: 'ocr-gt-tools.cgi?action=save',
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

function scaleElement(el, delta) {
    var curScale = el.getBoundingClientRect().width / el.offsetWidth;
    var newScale = curScale;
    if (!delta && typeof delta === 'boolean') {
        newScale = 1;
    } else {
        newScale = Math.max(0.3, curScale + delta);
    }
    $(el)
         .css('-moz-transform', 'scale(' + newScale + ')')
         .css('-moz-transform-origin', '0 0')
         .css('-o-transform', 'scale(' + newScale + ')')
         .css('-o-transform-origin', '0 0')
         .css('-ms-transform', 'scale(' + newScale + ')')
         .css('-ms-transform-origin', '0 0')
         .css('-webkit-transform', 'scale(' + newScale + ')')
         .css('-webkit-transform-origin', '0 0')
         .css('transform', 'scale(' + newScale + ')')
         .css('transform-origin', '0 0');
}

function scaleHeight(el, factor) {
    var curHeight = el.getAttribute('height') || el.offsetHeight;
    if (!el.hasAttribute('data-original-height')) {
        el.setAttribute('data-original-height', curHeight);
    }
    var originalHeight = el.getAttribute('data-original-height');
    var newHeight = factor == 1 ? originalHeight : curHeight * factor;
    el.setAttribute('height',  newHeight);
}

function onClickZoomIn() {
    $('#file_correction img').each(function() {
        scaleHeight(this, 1.4);
    });
}

function onClickZoomOut() {
    $('#file_correction img').each(function() {
        scaleHeight(this, 0.8);
    });
}

function onClickZoomReset() {
    $('#file_correction img').each(function() {
        scaleHeight(this, 1);
    });
}

/**
 * Transform text file to array of line lineComments
 *
 * @param {String} txt Contents of the text file
 *
 * @return {Array} List of line lineComments
 */
function parseLineComments(txt) {
    var lines = txt.split(/\n/);
    var lineComments = [];
    for (var i = 0; i < lines.length ; i++) {
        var lineComment = lines[i].replace(/^\d+:\s*/, '');
        lineComments.push(lineComment);
    }
    window.ocrGtLocation.pageComment = lineComments[0];
    window.ocrGtLocation.lineComments = lineComments.slice(1);
    return lineComments;
}

/**
 * Adds comment fields
 */
function addCommentFields() {
    $("td[contenteditable][spellcheck]").each(function(curLine) {
        var curComment = window.ocrGtLocation.lineComments[curLine];
        $(this)
        .parent('tr').append(
            $('<td id="tools-' + (curLine) + '" >')
            .append($('<span class="span-commenting-o "><i class="fa fa-commenting-o"></i></span>')
                    .toggleClass('hidden', curComment === ''))
            .append($('<span class="span-map-o "><i class="fa fa-map-o"></i></span>')
                    .toggleClass('hidden', curComment !== ''))
            .on('click tap', function() { toggleLineComment(curLine); })
        ).closest('table')
            .attr('data-line-number', curLine)
            .append(
                $('<tr class="lineComment">' +
                    '<td contenteditable>' +
                        curComment         +
                    '</td>'                +
                '</tr>')
            );
    });
    $("#file_correction").prepend(
        '<div class="pageComment" contenteditable>' +
            window.ocrGtLocation.pageComment +
        '</div>'
    );
}

/**
 * Loads a URL for editing.
 *
 * @param {string} url The image URL to load
 */
function reloadOcrGtLocation(url) {

    if (!url) {
        return;
    }

    $("#wait_load").removeClass("hidden");
    $('#file_name').html(url);
    $('#file_image').html('<img src=' + url + '>');

    $.ajax({
        type: 'POST',
        url: 'ocr-gt-tools.cgi?action=create',
        data: {'data_url': url},
        beforeSend: function(xhr) {
            // to instantly see when a new document has been retrieved
            $("#file_correction").addClass("hidden");
        },
        success: function(res) {
            // file correction will be loaded
            window.ocrGtLocation = res;
            window.location.hash = window.ocrGtLocation.imageUrl;
            $("#file_correction").load(uncachedURL(window.ocrGtLocation.correctionUrl), handleCorrectionAjax);

            // Zoom buttons only for non-IE
            $("#zoom_button_plus").removeClass("hidden");
            $("#zoom_button_minus").removeClass("hidden");
            $("#save_button").removeClass("hidden");
            // activate button if #file_correction is changed

            // Add links to downloads to the DOM
            $("#file_links").html(
                "<div id='file_rem'><a download href='" + res.commentsUrl + "' target='_blank'>anmerkungen.txt</a></div>" +
                "<div id='file_o_rem'><a download href='" + res.correctionUrl + "' target='_blank'>correction.html</a></div>" +
                "<div id='file_m_rem'><a download href='" + res.correctionPath + "correction_remarks.html' target='_blank'>correction_remarks.html</a></div>");

        },
        error: function(x, e) {
            window.alert(x.status + " FEHLER aufgetreten: \n" + e);
        }
    });
}

function onInput() {
    //window.alert("input event fired");
    $("#save_button").removeClass("inaktiv").addClass("aktiv");
    window.ocrGtLocation.changed = true;
}

function toggleLineComment(nID) {
    var $trLineComment = $("table[data-line-number='" + nID + "'] tr.lineComment");
    if ($trLineComment.hasClass("hidden")) {
        $trLineComment.removeClass("hidden");
        $("#tools-" + nID).find("span.span-commenting-o").addClass("hidden");
        $("#tools-" + nID).find("span.span-map-o").removeClass("hidden");
    } else {
        $trLineComment.addClass("hidden");
        $("#tools-" + nID).find("span.span-map-o").addClass("hidden");
        $("#tools-" + nID).find("span.span-commenting-o").removeClass("hidden");
    }
}

function resetAllEntries() {

    var r = window.confirm("Alle Eingaben zurücksetzen?");
    if (r) {
        $('tr:nth-child(3n)').find('td:nth-child(1)').each(function() {
            console.log($(this).html());
            $(this).html('');
        });
        $('tr:nth-child(4n)').find('td:nth-child(1)').each(function() {
            console.log($(this).html());
            $(this).html('');
        });
    }
}

function onHashChange() {
    var cHash = window.location.hash;

    if (window.ocrGtLocation && window.ocrGtLocation.changed) {
        window.alert("Ungesicherte Inhalte vorhanden, bitte zuerst speichern!");
    } else {
        if (cHash !== '') {
            reloadOcrGtLocation(cHash.substring(1));
        }
    }
}

$(function() {
    onHashChange();
    window.onhashchange = onHashChange;
    $(document).bind('drop dragover', function(e) {
        // Prevent the default browser drop action:
        e.preventDefault();
    });
    $(document).bind('drop', function(e) {
        e.preventDefault();

        if (window.ocrGtLocation && window.ocrGtLocation.changed) {
            window.alert("Ungesicherte Inhalte vorhanden, bitte zuerst speichern!");
        } else {
            var dropped = e.originalEvent.dataTransfer.getData('text/html');
            var url = $(dropped).find('img').addBack('img').attr('src');
            if (!url) {
                url = $(dropped).find('a').addBack('a').attr('href');
            }
            if (url) {
                reloadOcrGtLocation(url);
            } else {
                window.alert("Konnte keine URL erkennen.");
            }
        }
    });
    // event listeners
    $("#file_correction").on('input', onInput);
    $("#save_button").on("click", onClickSave);
    $("#zoom_button_plus").on("click", onClickZoomIn);
    $("#zoom_button_minus").on("click", onClickZoomOut);
    $("#zoom_button_reset").on("click", onClickZoomReset);

});

// vim: sw=4 ts=4 :
