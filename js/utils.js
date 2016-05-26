/********************/
/* Utiliy functions */
/********************/

var Utils = {};

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
Utils.compileTemplates = function compileTemplates() {
    var templates = {};
    $("*[id^='tpl-']").each(function() {
        var $this = $(this);
        var tplId = $this.attr('id').replace(/^tpl-/, '');
        templates[tplId] = Handlebars.compile($this.html());
    });
    return templates;
};

/**
 * Shrink/expand a textarea to fit its contents
 */
Utils.fitHeight = function expandTextarea(selector) {
    $(selector).each(function() {
        $(this)
            .attr('rows', 1) // Must be one for single-line textareas
            .css({'height': 'auto', 'overflow-y': 'hidden', 'resize': 'none'})
            .height(this.scrollHeight);
    });
};

/**
 * Fist, for all descendants of `parent`, run fn1
 * Seoncd, For all descendants of `parent` that match `selectors` as well as their parents and descendants: run fn1
 *
 * First go is to mark something (like add a class 'hidden').
 * Second fn then unmarks that for the matching selectors.
 */
Utils.runOnSubtreeAndParents = function addClassToTree(parent, selectors, fn1, fn2) {
    $(parent)
        .find("*").each(fn1).addBack()
        .find(selectors)
            .each(fn2)
            .find('*').each(fn2)
            .addBack()
            .parents('*').each(fn2);
};
