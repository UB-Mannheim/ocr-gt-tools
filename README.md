# ocr-gt-tools

  * [Summary](#summary)
    * [About the code](#about-the-code)
  * [Installation](#installation)

Copyright (C) 2014–2016 Universitätsbibliothek Mannheim

Authors: Bernd Fallert (UB Mannheim)

This is free software. You may use it under the terms of the
GNU General Public License (GPL). See [LICENSE](LICENSE) for details.


## Summary

ocr-gt-tools




### About the code

I use html javascript perl


### Installation

See [INSTALL.md](INSTALL.md) for details.

## Usage

- you must previously have created the hocr file, for example with Tesseract
- Open 'ocr-gt-tools/index.html' with Google Chrome. The 2 Buttons (Zoom + and Zoom -) will not work in Firefox, so at the moment they are not shown in Firefox
- open in a second Window 'Page Previews' from Goobi
- search the book from which you created the hocr file
- drag and drop a image from the Goobi 'Page Preview' Window to the Window with 'ocr-gt-tools/index.html'
- the perl script erzeuge_files.pl will create in the background all files, which takes a few seconds
- with ajax a json objects will be returned to index.html
- index.html will load with ajax the created 'correction.html' inline
- in Google Chrome you get three buttons
  - Zoom -
  - Zoom +
  - Speichern
- 'Speichern' will get active if you have written a comment or a text line
- when a new image is dropped and it is unsaved content available a warning is issued, same as if the hash is changed in the url



## Bug reports

Please send your bug reports to https://github.com/UB-Mannheim/ocr-gt-tools/issues.
Make sure that you are using the latest version of the software
before sending a report.


## Contributing

Bug fixes, new functions, suggestions for new features and
other user feedback are appreciated.

The source code is available from https://github.com/UB-Mannheim/ocr-gt-tools.
Please prepare your code contributions also on GitHub.


## Acknowledgments

This project uses other free software:

* Font Awesome by Dave Gandy – http://fontawesome.io/ (SIL OFL 1.1, MIT License)
* jQuery - http://jquery.com/ (Mit License)
* hocr-extract-images
* ocropus-gtedit
