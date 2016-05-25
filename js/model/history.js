function History() { }
History.prototype.url = 'ocr-gt-tools.cgi?action=history&mine=true';
History.prototype.load = function(cb) {
    var self = this;
    $.ajax({
        url: this.url,
        dataType: "json",
        error: cb,
        success: function(data) {
            notie.alert(1, "History geladen", 1);
            self.items = data;
            cb(null, self);
        },
    });
};


