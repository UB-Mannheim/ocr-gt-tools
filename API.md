# API

Data model
----------

The system handles images and text:

* images
  * page
  * line in page
* text
  * transcription of a line
  * comment on a line
  * comment on a page

Images are transferred as URL between server and client.

Text is exchanged inline.

Protocol
--------

Clients ask for editable representations of URL (`imageUrl`)

`GET http://ocr-gt/?action=create&imageUrl=http://ocr-gt/image/page1_thumb.png`

Server tries to resolve that into an editable location (i.e. a page). If no
such representation currently exists and the server has all the required assets
(high-res image and hCOR file), it creates it. If found, it sends that location
as JSON to the client:

```yaml
title: '1'
url:
  thumb-url: http://ocr-gt/image/page1_thumb.png
  hires-url: http://ocr-gt/image/page1_max.png
  hocr-url:  http://ocr-gt/hocr/page1.hocr
  landing-page-url: http://some.where/kitodo/1
line-images:    ["http://ocr-gt/image/page1/line-001.png", …]
transcriptions: ["…", …]
page-comment:   "…"
line-comments:  ["…", …]
```

All these fields are **required** (client must not check), except for 'title'
(fall back to url.thumb-url) and page-comment (fall back to empty string).

Client edits transcriptions/comments as needed and sends back representation as JSON:

```
POST http://ocr-gt/?action=save&imageUrl=http://ocr-gt/image/page1_thumb.png
```

```yaml
page-comment:   "This page is awesome"
transcriptions: ["Fist line transcribed", …]
line-comments:  ["I like this line. It is nice.", …]
```

Server merges this with its representation of the location and stores it.

Formats
-------

* Clients should be able to load a full representation (e.g. zipped folder of
  transcriptions, comments, images, hocr and full size)

Storage
-------

Server-side storage should be opaque to the client, the following is only
relevant for this particular implementation.

All generated data lives in one directory that can be uniquely mapped to a
page, e.g.  `/path/to/work1/page1/`.

* Every line image is saved in a file `line-XXXX.png`
* Every line transcription is saved in a file `line-XXXX.txt`
* Every line OCR output is saved in a file `ocr-XXXX.txt`
* Every line comment is saved in a file `comment-line-XXXX.txt`
* Page transcription is saved in a file `comment-page.txt`

`XXXX` is a four-digit zero-padded positive integer, e.g. `0023`.

`XXXX` is continuously incrementing from 1 (i.e. `line-0001.txt`,
`line-0002.txt`) and represents the position of the line in the document order
of the original document

* For every `line-XXXX.txt` there must be one `comment-line-XXXX.txt`.
* For every `comment-line-XXXX.txt` there must be one `line-XXXX.txt`.
* For every `line-XXXX.png` there must be one `line-XXXX.txt`

JS API
------

* One window-global object 'wndow.app' (app.js)
	* constructor:
		* templates: The compiled handlebar templates as functions
		* models: Set up the models used in the app
			* currentPage: The page model currently edited
	* init():
		* Load read-only data from server (special-chars/error-tags)
		* Set up the app-global views:
			* pageView: A view on the current page, doesn't change
	* loadPage(url):
		* Replace the currentPage model with one loaded from url
		* Set pageView.model to the new model and re-render
	* savePage():
		* Save the current page
* Models: Contain the data, that can be saved/loaded
	* constructor: url or object
		* Default values
		* State vars (e.g. was the model modified since last save
	* load: Load the model from storage (server, localStorage...)
	* save: Save the model to storage (server, localStorage...)
* Views: Contain the visual representation and business logic
	* constructor(obj)
		* obj.el: jQuery selector of the element backed by this view
		* obj.$el: jQuery object wrapping obj.el
		* obj.tpl: template function to build html
		* obj.model: The model backing this view
	* render:
		* create HTML form templates
		* bind events to HTML elements
		* bind to app-global events
* Events:
	* app:loading: When starting to load a page
	* app:loaded: Successfully loaded a page
	* app:saving: When starting to save a page
	* app:saved: Successfully saved a page
	* app:changed: When any input field is changed
	* app:enter-select-mode: When beginning multi-select
	* app:exit-select-mode: When leaving multi-select
* ocr-gt-tools.js now merely constructs the app
* All JS files are concatenated to dist/ocr-gt-tools.js
* By file:
  * js/models
    * cheatsheet: Represents special-chars.json
    * error-tags: Represents error-tags.json
    * history: The request log for the current user
    * line: A line in a page, generated from the 'page' array properties
      without the 'line-' prefix
    * page: A page, containing lines and a comment
    * settings: The UI settings for the current user
  * js/views
    * animation-view: Animation of glyphs while page is loading
    * cheatsheet-view: Table of characters, images, copy-to-clipboard functionality..
    * dropzone-view: The area of the page where URLs can be dropped
    * history-view: Table of past requests to keep track
    * line-view: View of a single line, handles button logic and model-sync
    * page-view: View of a page, creates line-views as necessary, model-sync
    * sidebar: The sidebar containing work/collection/page info
    * toolbar: THe toolbar with buttons for accessing all the actions
  * app: Global app class, entry point to the application
  * utils:
    * Various, stateless helper functions
