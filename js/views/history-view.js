function HistoryView(opts) {
    for (key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}
HistoryView.prototype.render = function() {
    this.$el.find("tbody").empty();
    for (var i = 0; i < this.model.items.length ; i++) {
        this.$el.find("tbody").append(this.tpl(this.model.items[i]));
    }
};

