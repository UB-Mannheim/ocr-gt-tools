function CheatsheetView(opts) {
    for (key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
    // Setup clipboard
    new Clipboard('.code');
}

CheatsheetView.prototype.applyFilter = function applyFilter() {
    var self = this;
    $.each(self.model.items, function(id, desc) {
        if (self.filter &&
            self.filter !== "" &&
            desc.baseLetter.indexOf(self.filter) === -1 &&
            desc.baseLetter.indexOf(self.filter.toLowerCase()) === -1) {
            $("#cheatsheet-" + desc.id).addClass('hidden');
        } else {
            $("#cheatsheet-" + desc.id).removeClass('hidden');
        }
    });
};

CheatsheetView.prototype.render = function render() {
    var self = this;
    self.$el.find(".cheatsheet").empty();
    $.each(self.model.items, function(idx, model) {
        self.$el.find('.cheatsheet').append(self.tpl(model));
    });
    self.$el.find('button').on('click', function() {
        notie.alert(1, "In Zwischenablage kopiert: '" + $(this).attr('data-clipboard-text') + "'", 1);
    });
    self.$el.find('input[type="text"]').on('keydown', function(e) {
        self.filter = (e.keyCode < 32 || e.ctrlKey || e.altKey) ?  null : String.fromCharCode(e.keyCode);
        self.applyFilter();
        $(this).val('');
    });
    return self;
};
