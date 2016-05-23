function CheatsheetView($el, model) {
    var self = this;
    self.model = model;
    self.$el = $el;
    self.rendering = false;
    self.$el.find('input[type="text"]').on('keydown', function(e) {
        if (e.keyCode < 32 || e.ctrlKey || e.altKey) {
            self.filter = null;
        } else {
            self.filter = String.fromCharCode(e.keyCode);;
        }
        self.applyFilter();
        $(this).val('');
    });
}
CheatsheetView.prototype.applyFilter = function applyFilter() {
    var self = this;
    $.each(self.model, function(id, desc) {
        if (self.filter &&
            self.filter !== "" &&
            desc.baseLetter.indexOf(self.filter) === -1 &&
            desc.baseLetter.indexOf(self.filter.toLowerCase()) === -1) {
            $("#cheatsheet-" + id).addClass('hidden');
        } else {
            $("#cheatsheet-" + id).removeClass('hidden');
        }
    });
};
CheatsheetView.prototype.render = function render() {
    var self = this;
    self.$el.find(".cheatsheet").empty();
    $.each(Object.keys(self.model), function(idx, key) {
        self.$el.find('.cheatsheet').append(window.templates.cheatsheetEntry(self.model[key]));
    });
    self.$el.find('button').on('click', function() {
        notie.alert(1, "In Zwischenablage kopiert: '" + $(this).attr('data-clipboard-text') + "'");
    });
    return self;
};
