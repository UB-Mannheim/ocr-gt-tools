function Sidebar(opts) {
    for (var key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}

Sidebar.prototype.render = function renderSidebar() {
    this.$el.empty().html(window.app.templates.rightSidebar(this.model));

    var self = this;
    this.$el.on('input', function() {
        self.model['page-comment'] = self.$el.find('textarea').val();
        window.app.emit('app:changed');
    });
};
