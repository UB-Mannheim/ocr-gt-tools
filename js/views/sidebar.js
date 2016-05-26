function Sidebar(opts) {
    for (var key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}

Sidebar.prototype.render = function renderSidebar() {
    this.$el.empty().html(window.app.templates.rightSidebar(this.model));
};
