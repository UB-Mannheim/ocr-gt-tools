// ==UserScript==
// @name        Extract Special Characters
// @namespace   http://github.com/kba/
// @include     https://github.com/UB-Mannheim/ocr-gt-tools/wiki/Special-Characters
// @version     1
// @require     https://code.jquery.com/jquery-2.2.3.min.js
// @grant       none
// ==/UserScript==

console.log('x');
var letterJson = {};
$("h2").each(function() {
  var letterDesc = {};
  var letterId = $(this).text().trim();
  letterJson[letterId] = letterDesc;
  $(this).next('ul').find('li').each(function() {
    var varName = $(this).text().replace(/\s*:.*/, '');
    var rawValue = $(this).html().replace(/^.*\s*:\s*/, '');
    console.log(letterId);
    letterDesc[varName] = rawValue;
    if (varName.equals('Base Letter') || varName.equals('Sample')) {
      letterDesc[varName] = rawValue.split(/\s*;\s*/);
      console.log(letterJson);
    }
  });
});
