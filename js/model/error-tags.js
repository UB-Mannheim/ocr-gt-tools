function ErrorTags() {
    this.items = [];
}
ErrorTags.prototype.url = 'error-tags.json';
ErrorTags.prototype.load = function(cb) {
    var self = this;
    $.ajax({
        url: this.url,
        dataType: "json",
        error: cb,
        success: function(data) {
            self.items = [];
            var keys = Object.keys(data);
            for (let i = 0; i < keys.length; i++) {
                self.items.push(data[keys[i]]);
            }
            cb();
        },
    });
};
