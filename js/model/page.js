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
    if (!this.changed) {
        notie.alert(2, "Nothing changed.", 1);
        return;
    }
    $("#wait_save").addClass("wait").removeClass("hidden");
    $("#disk").addClass("hidden");
    this['line-transcriptions'] = $('li.transcription div').map(function() {
        return Utils.encodeForServer($(this).html());
    }).get();
    this['line-comments'] = $("li.line-comment div").map(function() {
        return Utils.encodeForServer($(this).html());
    }).get();
    this['page-comment'] = Utils.encodeForServer($("#page-comment div").html());
    // console.log(window.app.currentPage.pageComment);
    // console.log(window.app.currentPage.transcriptions);
    // console.log(window.app.currentPage.lineComments);

    $.ajax({
        type: 'POST',
        url: 'ocr-gt-tools.cgi?action=save',
        data: this.toJSON(),
        error: cb,
        success: function() {
            cb();
        },
    });
};

Page.prototype.toJSON = function() {
    var ret = {};
    ret.ids                    = this.ids;
    ret.url                    = this.url;
    ret['line-comments']       = this['line-comments'];
    ret['page-comment']        = this['page-comment'];
    ret['line-transcriptions'] = this['line-transcriptions'];
    return ret;
};

Page.prototype.load = function(cb) {
    var self = this;
    $.ajax({
        type: 'GET',
        url: 'ocr-gt-tools.cgi?action=create&imageUrl=' + this.imageUrl,
        error: cb,
        success: function(res) {
            console.log(res);
            for (key in res) { self[key] = res[key]; }
            cb();
        },
    });
};
