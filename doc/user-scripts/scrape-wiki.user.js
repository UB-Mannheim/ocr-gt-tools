// ==UserScript==
// @name        Extract Special Characters
// @namespace   http://github.com/kba/
// @include     https://github.com/UB-Mannheim/ocr-gt-tools/wiki/Special-Characters
// @include     https://github.com/UB-Mannheim/ocr-gt-tools/wiki/Error-Tags
// @description Extract special character data from ocr-gt-tools wiki
// @version     1
// @require     https://code.jquery.com/jquery-2.2.3.min.js
// @require     https://cdnjs.cloudflare.com/ajax/libs/z-schema/3.17.0/ZSchema-browser.js
// @grant       GM_addStyle
// @grant       GM_setClipboard
// ==/UserScript==
/*globals GM_addStyle */
/*globals ZSchema */

var CSS = `
pre.schema-error
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
div#schema-bar
{
    position: fixed;
    z-index: 3000;
    top: 0;
    background: #900;
    color: white !important;
    width: 100%;
    font-size: x-large;
    height: 48px;
    border: 2px solid black;
}
div#schema-invalid
{
    display: none;
}
div#schema-invalid a
{
    display: inline-block;
    color: white !important;
    float: none;
    margin: 0 2px;
}
`;

var SCHEMAS = {
    'Special-Characters': {
        'type': 'object',
        "additionalProperties": false,
        'properties': {
            'id': {
                'type': 'string',
                'pattern': '^[a-z0-9-]+$',
            },
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
    },
    'Error-Tags': {
        'type': 'object',
        "additionalProperties": false,
        'properties': {
            'id': {
                'type': 'string',
                'pattern': '^[a-z0-9-]+$',
            },
            'name': {
                'type': 'object',
                'properties': {
                    'de': {
                        'type': 'string',
                    },
                    'en': {
                        'type': 'string',
                    },
                },
                'required': ['de']
            },
            'frequencyAvg': {
                'type': 'number',
                // 'format': 'float',
            },
            'total': {
                'type': 'number',
                // 'format': 'integer',
            },
            'comment': {
                'type': 'object',
                'properties': {
                    'de': {
                        'type': 'string',
                    },
                    'en': {
                        'type': 'string',
                    },
                },
                'required': ['de']
            },
        },
        'required': ['name'],
    }
};

// var log = {
//     'debug': console.log.bind(console),
//     'info': console.info.bind(console),
//     'error': console.error.bind(console),
// };

var ON_LOAD = {
    'Special-Characters': function(scraped) {
        $("body").append(`
            <div id="glyph-bar">
                <div class="left">
                    <label for="glyph-input" style="font-family: monospace; font-size: 30px">TRY&gt;</label>
                    <input id="glyph-input" type="text"/>
                    <div id="glyph-propose">&nbsp;</div>
                </div>
            </div>
        `);
        $("#glyph-input").on('keyup', function(e) {
            var $input = $("#glyph-input");
            var from = $input[0].selectionStart;
            var to = $input[0].selectionEnd;
            if (from == to) {
                from -= 1;
            }
            $('#glyph-propose').empty();
            var $propose = $('#glyph-propose');
            var val = $input.val();
            var chosen = val.substring(from, to);
            console.log(chosen, from, to);
            $.each(scraped, function() {
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
        });
    },
    'Error-Tags': function(scraped) {
        console.log('Not Implemented for Error-Tags (yet?)');
    }
};

function scrapeJsonFromWikiPage(schema) {
    var parsed = {};
    var validator = new ZSchema();
    var h2s = $(".markdown-body h2").get();
    for (var i = 0; i < h2s.length; i++) {
        var $h2 = $(h2s[i]);
        var thingDesc = {};
        var thingId = $h2.text().trim();
        parsed[thingId] = thingDesc;
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
            // console.log(`Parsing '${varName}'`);
            var rawValue = liHtml.substring(colonIndex + 1).trim();
            if (schema.properties[varName] && schema.properties[varName].type === 'array') {
                thingDesc[varName] = rawValue.split(/\s*;\s*/);
            } else if (schema.properties[varName] && schema.properties[varName].type === 'number') {
                thingDesc[varName] = parseFloat(rawValue);
            } else if (/[A-Z][a-z]$/.test(varName)) {
                var lang = varName.substr(-2).toLowerCase();
                varName = varName.substring(0, varName.length - 2);
                thingDesc[varName] = thingDesc[varName] || {};
                thingDesc[varName][lang] = rawValue;
            } else {
                thingDesc[varName] = rawValue;
            }
        }
        thingDesc.id = thingId;
        console.log([thingDesc, schema]);
        if (!validator.validate(thingId, schema.properties.id)) {
            showError(thingId, validator.getLastErrors());
        }
        if (!validator.validate(thingDesc, schema)) {
            showError(thingId, validator.getLastErrors());
        }
    }
    return parsed;
};

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

function showError(faultyId, err) {
    $(`h2:contains('${faultyId}')`).append(
        `<pre class='schema-error'>${escapeHTML(JSON.stringify(err, null, 2))}</pre>`);
    $("#schema-invalid").show().append(
        `<a href="#${faultyId}">[${ $("#schema-invalid a").length + 1}]</a>`);
}

$(function() {
    GM_addStyle(CSS);
    $("body").prepend(
    `
<div id="schema-bar">
    <div id="schema-invalid">!! INVALID </div>
    <div class="right">
        <button id="copy-schema">Copy Schema</button>
        <button id="copy-json">Copy Data</button>
    </div>
</div>
    `);
    var wikiPage = window.location.href.replace(/.*\//, '').replace(/#.*$/, '');
    var schema = SCHEMAS[wikiPage];
    var scraped = scrapeJsonFromWikiPage(schema);
    ON_LOAD[wikiPage](scraped);
    $("#copy-schema").on('click', function() {
        GM_setClipboard(JSON.stringify(SCHEMAS[schema], null, 2));
        window.alert("Copied JSON schema to clipboard");
    });
    $("#copy-json").on('click', function() {
        GM_setClipboard(JSON.stringify(scraped, null, 2));
        window.alert("Copied JSON schema to clipboard");
    });
});
