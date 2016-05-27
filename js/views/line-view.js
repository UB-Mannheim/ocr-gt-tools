function LineView(opts) {
    for (var key in opts) { this[key] = opts[key]; }
    this.tpl = window.app.templates.line;
}

/**
 * Update the color of the comment toggle button depending on whether line has
 * comments or not.
 */
LineView.prototype.renderCommentToggler = function renderCommentToggler() {
    var hasComment = this.model.comment.length > 0;
    var isVisible = this.$el.find('.line-comment').is(':visible');
    var $toggler = this.$el.find(".toggle-line-comment");
    $toggler.find(".show-line-comment").toggleClass('hidden', isVisible);
    $toggler.find(".hide-line-comment").toggleClass('hidden', !isVisible);
    $toggler.toggleClass('btn-default', !hasComment).toggleClass('btn-info', hasComment);
};

LineView.prototype.setSelected = function setSelected(selected) {
    this.model.selected = selected;
    this.renderSelected();
};

LineView.prototype.onEnterSelectMode = function onEnterSelectMode() {
    this.$el.find('.select-col').toggleClass('hidden', false);
    this.$el.find('.button-col').toggleClass('hidden', true);
    var self = this;
    this.$el.on('click', function() { self.setSelected(!self.model.selected); });
};

LineView.prototype.onExitSelectMode = function onExitSelectMode() {
    this.$el.find('.select-col').toggleClass('hidden', true);
    this.$el.find('.button-col').toggleClass('hidden', false);
    this.$el.off('click');
};

LineView.prototype.renderSelected = function renderSelected() {
    this.$el.toggleClass('selected', this.model.selected);
    this.$el.find(':checkbox').prop('checked', this.model.selected);
};

LineView.prototype.render = function() {
    var self = this;

    this.$el.off().find("*").off();
    // Build from template
    this.$el.html($(self.tpl(this.model)));

    this.$el.find(".toggle-line-comment").on('click', function() {
        var commentField = self.$el.find('.line-comment');
        commentField.toggleClass('hidden', commentField.is(':visible')).removeClass('view-hidden');
        self.renderCommentToggler();
    });

    // data binding
    this.$el.find("input,textarea").on('input', function(e) {
        self.model.comment = self.$el.find('.line-comment textarea').val().trim();
        self.model.transcription = self.$el.find('.line-transcription input').val().trim();
        self.renderCommentToggler();
        Utils.fitHeight(this);
        window.app.emit('app:changed');
    });

    // Add error tag on click
    this.$el.find("*[data-tag]").on('click', function(e) {
        var tag = $(this).attr('data-tag');
        if (self.model.addTag(tag)) {
            self.$el.removeClass('hidden');
            self.$el.removeClass('hidden');
            self.render();
            window.app.emit('app:changed');
        }
    });

    // Adapt the textarea height
    Utils.fitHeight(this.$el.find('textarea'));

    // Highlight button w/ comments
    window.app.once('app:loaded', this.renderCommentToggler.bind(this));
    window.app.on('app:filter-view', this.renderCommentToggler.bind(this));
    window.app.on('app:enter-select-mode', this.onEnterSelectMode.bind(this));
    window.app.on('app:exit-select-mode', this.onExitSelectMode.bind(this));

    return this;
};
