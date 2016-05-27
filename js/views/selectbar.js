function Selectbar(opts) {
    for (var key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}

Selectbar.prototype.enter = function enter() {
    window.app.selectMode = true;
    this.$el.removeClass('hidden');
    window.app.emit('app:enter-select-mode');
};

Selectbar.prototype.exit = function exit() {
    window.app.selectMode = false;
    this.$el.addClass('hidden');
    window.app.emit('app:exit-select-mode');
};
Selectbar.prototype.toggle = function toggle() {
    this[window.app.selectMode ? 'exit' : 'enter']();
};

Selectbar.prototype.selectLines = function selectLines(action, ids) {
    var app = window.app;
    // If no id was passed, use all ids
    if (!ids) {
        ids = [];
        for (var i = 0; i < app.currentPage.lines.length; i++) {
            ids.push(i);
        }
    }
    for (var i = 0; i < ids.length; i++) {
        var lineView = app.pageView.lineViews[ids[i]];
        lineView.setSelected(action === 'select' ? true : action === 'unselect' ? false : !lineView.model.selected);
    }
};

Selectbar.prototype.render = function renderSelectBar() {
    var self = this;
    var app = window.app;

    this.$el.find('.select-all').on('click', function selectAll() { self.selectLines('select'); });
    this.$el.find('.select-none').on('click',  function selectNone() { self.selectLines('unselect'); });
    this.$el.find('.select-toggle').on('click', function selectToggle() { self.selectLines('toggle'); });

    app.on('app:select-line', this.selectLines.bind(self));
    app.on('app:loading', function() { $(".toggle-select-mode").off('click'); });
    app.on('app:loaded', function() { $(".toggle-select-mode").on('click', self.toggle.bind(self)); });
};
