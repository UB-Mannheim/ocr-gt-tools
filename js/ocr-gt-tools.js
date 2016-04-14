// Name: ocr-gt-tools.js

/**
 * Handle a $load completion event.
 *
 */
function handleCorrectionAjax(response, status, xhr) {
    $.ajax({
        type: 'GET',
        url: window.ocrGtLocation.commentsUrl,
        error: function(x, e) {
            window.alert(x.status + " FEHLER aufgetreten: \n" + e);
        },
        success: function(response, status, xhr) {
            parseLineComments(response);
            addCommentFields(window.ocrGtLocation);
            // hide waiting spinner
            $("#wait_load").addClass("hidden");
            // show new document
            $("#file_correction").removeClass("hidden");
        }
    });
}

/**
 * When the document should be saved back to the server.
 *
 */
function onClickSave() {

    if (window.location.saved) {
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
    window.ocrGtLocation.pageComment = $(".pageComment").html();

    $.ajax({
        type: 'post',
        url: 'ocr-gt-tools.cgi?action=save',
        data: window.ocrGtLocation,
        success: function() {
            // after #file_correction is saved
            window.ocrGtLocation.saved = false;
            $("#wait_save").removeClass("wait").addClass("hidden");
            $("#disk").removeClass("hidden");
            $("#save_button").addClass("inaktiv").removeClass("aktiv");
            document.getElementById("file_correction").addEventListener("input", onInput);
        },
        error: function(x, e) {
            window.alert(x.status + " FEHLER aufgetreten");
        }
    });
}

function onClickZoomIn() {
    var nZoom = parseFloat($("#file_correction").css("zoom"));
    nZoom = nZoom + 0.4;
    $("#file_correction").css("zoom", nZoom);
}

function onClickZoomOut() {
    var nZoom = parseFloat($("#file_correction").css("zoom"));
    nZoom = nZoom - 0.4;
    $("#file_correction").css("zoom", nZoom);
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
        lineComments.push(lines[i].replace(/^\d+:\s*/, ''));
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
            var now = new Date();
            window.ocrGtLocation = res;
            var nowString = now.getFullYear() + now.getMonth() + now.getDay() +  now.getTime();
            //console.log(nowString);
            window.location.hash = window.ocrGtLocation.imageUrl;
            //$("#file_correction").load( res.correctionUrl + "?time=" + now, function(response, status, xhr) {
            $("#file_correction").load(window.ocrGtLocation.correctionUrl, handleCorrectionAjax);

            // Firefox 1.0+
            // http://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser
            var isFirefox = typeof InstallTrigger !== 'undefined';
            if (isFirefox) {
            } else {
                // Zoom buttons only for non-IE
                $("#zoom_button_plus").removeClass("hidden");
                $("#zoom_button_minus").removeClass("hidden");
            }
            $("#save_button").removeClass("hidden");
            // activate button if #file_correction is changed
            document.getElementById("file_correction").addEventListener("input", onInput);

            $("#save_button").off("click").on("click", onClickSave);
            $("#zoom_button_plus").on("click", onClickZoomIn);
            $("#zoom_button_minus").on("click", onClickZoomOut);

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
    document.getElementById("file_correction").removeEventListener("input", onInput);
    window.ocrGtLocation.saved = false;
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

    if (window.ocrGtLocation && !window.ocrGtLocation.saved) {
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

        if (!window.ocrGtLocation.saved) {
            window.alert("Ungesicherte Inhalte vorhanden, bitte zuerst speichern!");
        } else {
            var url = $(e.originalEvent.dataTransfer.getData('text/html')).find('img').attr('src');
            if (url) {
                reloadOcrGtLocation(url);
            } else {
                window.alert("Konnte keine URL erkennen.");
            }
        }
    });

});

// vim: sw=4 ts=4 :
