function CheatsheetView($el, model) {
    var self = this;
    self.model = model;
    self.$el = $el;
    this.rendering = false;
    self.$el.find('input[type="text"]').on('input', function(e) {
        if (self.rendering) {
            e.stopPropagation();
            e.preventDefault();
            return;
        }
        self.rendering = true;
        var val = $(this).val();
        if (val.length == 0) {
            self.filter = null;
        } else {
            $(this).val(val.substr(val.length - 1, 1));
            self.filter = $(this).val();
        }
    });
}
CheatsheetView.prototype.render = function render() {
    var self = this;
    var keys = Object.keys(self.model);
    self.$el.find(".cheatsheet").empty();
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (self.filter && self.model[key].baseLetter.indexOf(self.filter) === -1) {
            continue;
        }
        var row = window.templates.cheatsheetEntry(self.model[key]);
        self.$el.find(".cheatsheet").append(row);
    }
    self.$el.find('button').on('click', function() {
        notie.alert(1, "In Zwischenablage kopiert: '" + $(this).html() + "'");
    });
    self.rendering = false;
    return self;
};
