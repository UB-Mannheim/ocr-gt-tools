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
