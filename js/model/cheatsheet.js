function Cheatsheet() {
    this.items = [];
}
Cheatsheet.prototype.url = 'special-chars.json';
Cheatsheet.prototype.load = function(cb) {
    var self = this;
    $.ajax({
        url: this.url,
        dataType: "json",
        error: cb,
        success: function(data) {
            self.items = [];
            var keys = Object.keys(data);
            for (let i = 0; i < keys.length; i++) {
                var cheatsheetEntry = data[keys[i]];
                // console.log(cheatsheetEntry.id, cheatsheetEntry.recognition);
                self.items.push(cheatsheetEntry);
            }
            cb();
        },
    });
};

