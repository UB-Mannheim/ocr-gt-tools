function Page(urlOrOpts) {
    if (typeof urlOrOpts === 'string') {
        this.imageUrl = urlOrOpts;
    } else {
        this.imageUrl = urlOrOpts.imageUrl;
        for (key in urlOrOpts) { this[key] = urlOrOpts[key]; }
    }
    this.changed = false;
}

Page.prototype.save = function(cb) {
};

Page.prototype.load = function(cb) {
    var self = this;
    $.ajax({
        type: 'GET',
        url: 'ocr-gt-tools.cgi?action=create&imageUrl=' + this.imageUrl,
        error: cb,
        success: function(res) {
            for (key in res) { self[key] = res[key]; }
            cb();
        },
    });
};
