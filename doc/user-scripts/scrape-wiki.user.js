// ==UserScript==
// @name        Extract Special Characters
// @namespace   http://github.com/kba/
// @include     https://github.com/UB-Mannheim/ocr-gt-tools/wiki/Special-Characters
// @description Extract special character data from ocr-gt-tools wiki
// @version     1
// @require     https://code.jquery.com/jquery-2.2.3.min.js
// @require     https://cdnjs.cloudflare.com/ajax/libs/z-schema/3.17.0/ZSchema-browser.js
// @grant       GM_addStyle
// @grant       GM_setClipboard
// ==/UserScript==
/*globals GM_addStyle */
/*globals ZSchema */

var SCHEMA = {
    'type': 'object',
    "additionalProperties": false,
    'properties': {
        'sample': {
            'type': 'array',
            'items': {
                'type': 'string',
                'pattern': '^<a.*<img.*',
            }
        },
        'recognition': {
            'type': 'string'
        },
        'baseLetter': {
            'type': 'array'
        },
        'name': {
            'type': 'object'
        },
        'notes': {
            'type': 'object'
        },
        'shortcutLinux': {
            'type': 'string',
            'pattern': '^<kbd',
        },
        'shortcutWindows': {
            'type': 'string',
            'pattern': '^<kbd',
        },
    },
    'required': ['sample', 'recognition', 'baseLetter'],
};

window.scrapeSpecialGlyphs = function scrapeSpecialGlyphs() {
    var glyphJson = {};
    var validator = new ZSchema();
    var h2s = $(".markdown-body h2").get();
    for (var i = 0; i < h2s.length; i++) {
        var $h2 = $(h2s[i]);
        var glyphDesc = {};
        var glyphId = $h2.text().trim();
        glyphJson[glyphId] = glyphDesc;
        var lis = $h2.next('ul').find('li').get();
        for (var j = 0; j < lis.length; j++) {
            var liHtml = $(lis[j]).html();
            var colonIndex = liHtml.indexOf(':');
            var varName = liHtml.substring(0, colonIndex)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/_([a-z])/g, function(orig, ch) {
                    return ch.toUpperCase();
                })
                .replace(/^_|_$/, '');
            var rawValue = liHtml.substring(colonIndex + 1).trim();
            if (varName === 'baseLetter' || varName === 'sample') {
                glyphDesc[varName] = rawValue.split(/\s*;\s*/);
            } else if (/[A-Z][a-z]$/.test(varName)) {
                var lang = varName.substr(-2).toLowerCase();
                varName = varName.substring(0, varName.length - 2);
                glyphDesc[varName] = glyphDesc[varName] || {};
                glyphDesc[varName][lang] = rawValue;
            } else {
                glyphDesc[varName] = rawValue;
            }
        }
        if (!validator.validate(glyphDesc, SCHEMA)) {
            showError(glyphId, validator.getLastErrors());
        }
    }
    return glyphJson;
}

GM_addStyle(
`
pre.glyph-error
{
    background: #a00;
    color: white;
    white-space: pre-wrap;
}
div#glyph-bar
{
    font-size: x-large;
    position:fixed;
    bottom: 0;
    height: 48px;
    border: 2px solid black;
    background: white;
    width: 100%;
}
div#glyph-bar .left * { float: left; }
div#glyph-bar .right * { float: right; }
div#glyph-bar *
{
    height: 100%;
    font-size: x-large;
}
div#glyph-bar input[type='text']
{
    font-family: "Garamond", "Bookman", serif;
}
div#glyph-invalid
{
    display: none;
    background: #900;
    color: white !important;
    max-width: 50%;
    overflow-y: scroll;
}
div#glyph-invalid a
{
    display: inline-block;
    color: white !important;
    float: none;
    margin: 0 2px;
}
`
);
$("body").append(
`
<div id="glyph-bar">
    <div class="left">
        <label for="glyph-input" style="font-family: monospace; font-size: 30px">TRY&gt;</label>
        <input id="glyph-input" type="text"/>
        <div id="glyph-propose">&nbsp;</div>
    </div>
    <div class="right">
        <div id="glyph-invalid">!! INVALID </div>
        <button id="glyph-schema">Schema</button>
        <button id="glyph-json">JSON</button>
    </div>
</div>
`);

function escapeHTML(str) {
    var entityMap = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': '&quot;',
        "'": '&#39;',
        "/": '&#x2F;'
    };
    return String(str).replace(/[&<>"'\/]/g, function(s) {
        return entityMap[s];
    });
}

function showError(glyphId, err) {
    $(`h2:contains('${glyphId}')`).append(
        `<pre class='glyph-error'>${escapeHTML(JSON.stringify(err, null, 2))}</pre>`);
    $("#glyph-invalid").show().append(
        `<a href="#${glyphId}">[${ $("#glyph-invalid a").length + 1}]</a>`);
}

function clearProposals() {
    $('#glyph-propose').empty();
}

function showProposals($input, from, to) {
    clearProposals();
    var $propose = $('#glyph-propose');
    var val = $input.val();
    var chosen = val.substring(from, to);
    console.log(chosen, from, to);
    $.each(window.glyphJson, function() {
        var glyphDesc = this;
        if (glyphDesc.baseLetter.indexOf(chosen) === -1) {
            return;
        }
        $.each(glyphDesc.sample, function(i, sample) {
            $propose.append($(sample)
                .on('click', function(e) {
                    e.preventDefault();
                    $input.val(val.substr(0, from) + glyphDesc.recognition + val.substr(to));
                }));
        });
    });
}

$(function() {
    window.glyphJson = window.glyphJson || scrapeSpecialGlyphs();
    $("#glyph-input").on('keyup', function(e) {
        var $input = $("#glyph-input");
        var from = $input[0].selectionStart;
        var to = $input[0].selectionEnd;
        if (from == to) {
            from -= 1;
        }
        showProposals($input, from, to);
    });
    $("#glyph-schema").on('click', function() {
        GM_setClipboard(JSON.stringify(SCHEMA, null, 2));
        window.alert("Copied JSON schema to clipboard");
    });
    $("#glyph-json").on('click', function() {
        GM_setClipboard(JSON.stringify(window.glyphJson, null, 2));
        window.alert("Copied JSON schema to clipboard");
    });
});
