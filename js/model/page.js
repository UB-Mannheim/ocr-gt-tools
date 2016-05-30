function Page(urlOrOpts) {
    var self = this;
    self.lines = [];
    if (typeof urlOrOpts === 'string') {
        self.imageUrl = urlOrOpts;
    } else {
        self.imageUrl = urlOrOpts.imageUrl;
        for (key in urlOrOpts) { self[key] = urlOrOpts[key]; }
    }
    self.changed = false;
    window.app.on('app:changed', function setChanged() { self.changed = true; });
    window.app.on('app:saved', function setUnChanged() { self.changed = false; });
}

Page.prototype.toJSON = function() {
    var ret = {
        'line-comments': [],
        'line-transcriptions': [],
        'page-comment': this['page-comment'],
        'ids': this.ids,
        'url': this.url,
    };
    for (var i = 0; i < this.lines.length ; i++) {
        ret['line-comments'][i] = this.lines[i].comment.trim();
        ret['line-transcriptions'][i] = this.lines[i].transcription.trim();
    }
    return ret;
};

Page.prototype.save = function savePage(cb) {
    $.ajax({
        type: 'POST',
        url: 'ocr-gt-tools.cgi?action=save',
        contentType: 'application/json; charset=UTF-8',
        data: JSON.stringify(this.toJSON()),
        success: function() { cb(); },
        error: cb
    });
};

Page.prototype.load = function(cb) {
    var self = this;
    $.ajax({
        type: 'GET',
        url: 'ocr-gt-tools.cgi?action=get&imageUrl=' + this.imageUrl,
        error: cb,
        success: function(res) {
            for (key in res) { self[key] = res[key]; }
            // Sort 'pages'
            self.pages = self.pages.sort(function(a, b) { return parseInt(a.ids.page) - parseInt(b.ids.page); });
            // Create line models
            for (var i = 0; i < self['line-transcriptions'].length; i++)  {
                self.lines.push(new Line({
                    id: i,
                    transcription: self['line-transcriptions'][i],
                    comment: self['line-comments'][i],
                    image: self['line-images'][i],
                }));
            }
            cb();
        },
    });
};
