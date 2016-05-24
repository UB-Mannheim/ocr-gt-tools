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

Storage
-------

Server-side storage should be opaque to the client, the following is only
relevant for this particular implementation.

All generated data lives in one directory that can be uniquely mapped to a
page, e.g.  `/path/to/work1/page1/`.

* Every line image is saved in a file `line-XXXX.png`
* Every line transcription is saved in a file `line-XXXX.txt`
* Every line comment is saved in a file `comment-line-XXXX.txt`
* Page transcription is saved in a file `comment-page.txt`

`XXX` is a zero-padded positive integer, e.g. `023`.

`XXX` is continuously incrementing from 1 (i.e. `line-001.txt`, `line-002.txt`)
and represents the position of the line in the document order of the original
document

* For every `line-XXXX.txt` there must be one `comment-line-XXXX.txt`.
* For every `comment-line-XXXX.txt` there must be one `line-XXXX.txt`.
* For every `line-XXXX.png` there must be one `line-XXXX.txt`
