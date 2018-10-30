function HistoryView(opts) {
    for (let key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}
HistoryView.prototype.render = function() {
    this.$el.find("tbody").empty();
    for (let i = 0; i < this.model.items.length ; i++) {
        this.$el.find("tbody").append(this.tpl(this.model.items[i]));
    }
};

