function Selectbar(opts) {
    for (var key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}

Selectbar.prototype.enter = function enter() {
    this.selectLines('unselect');
    window.app.selectMode = true;
    this.$el.removeClass('hidden');
    window.app.emit('app:enter-select-mode');
};

Selectbar.prototype.exit = function exit() {
    this.selectLines('unselect');
    window.app.selectMode = false;
    this.$el.addClass('hidden');
    window.app.emit('app:exit-select-mode');
};

Selectbar.prototype.toggle = function toggle() {
    this[window.app.selectMode ? 'exit' : 'enter']();
};

Selectbar.prototype.getSelection = function getSelection() {
    var ret = [];
    for (var i = 0; i < app.pageView.lineViews.length; i++) {
        var lineView = app.pageView.lineViews[i];
        if (lineView.selected) ret.push(lineView);
    }
    return ret;
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
        lineView.selected = (action === 'select' ? true : action === 'unselect' ? false : !lineView.selected);
        lineView.renderCheckbox();
    }
};

Selectbar.prototype.render = function renderSelectBar() {
    var self = this;
    var app = window.app;

    this.$el.find('.select-all').on('click', function selectAll() {
        self.selectLines('select');
    });
    this.$el.find('.select-none').on('click', function selectNone() {
        self.selectLines('unselect');
    });
    this.$el.find('.select-toggle').on('click', function selectToggle() {
        self.selectLines('toggle');
    });
    this.$el.find('*[data-tag]').on('click', function addTagMultiple() {
        var tag = $(this).attr('data-tag');
        var selection = self.getSelection();
        for (var i = 0; i < selection.length; i++) {
            selection[i].addTag(tag);
        }
        window.app.emit('app:changed');
    });

    // app.on('app:select-line', this.selectLines.bind(self));
    var toggleBound = this.toggle.bind(this);
    app.on('app:loading', function() { $(".toggle-select-mode").off('click', toggleBound); });
    app.on('app:loaded', function() { $(".toggle-select-mode").on('click', toggleBound); });
};
