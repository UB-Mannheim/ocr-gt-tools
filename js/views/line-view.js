function LineView(opts) {
    for (let key in opts) { this[key] = opts[key]; }
    this.tpl = window.app.templates.line;
    window.app.once('app:loaded', this.render.bind(this));
    window.app.on('app:filter-view', this.renderToggler.bind(this));
    window.app.on('app:enter-select-mode', this.renderCheckbox.bind(this));
    window.app.on('app:exit-select-mode', this.renderCheckbox.bind(this));
}

/*
 * Render (or do not render) the checkbox for multi-select mode
 */
LineView.prototype.renderCheckbox = function renderComment() {
    var self = this;
    // Selectionmode
    this.$el.find('.select-col').toggleClass('hidden', !window.app.selectMode);
    this.$el.find('.button-col').toggleClass('hidden', window.app.selectMode);
    this.$el.toggleClass('selected', this.selected);
    this.$el.find(':checkbox').prop('checked', this.selected);
};

LineView.prototype.renderTextarea = function renderTextarea() {
    // fit height
    Utils.fitHeight(this.$el.find('textarea'));
};

/**
 * Update the color of the comment toggle button depending on whether line has
 * comments or not.
 */
LineView.prototype.renderToggler = function renderToggler() {
    var lineComment = this.$el.find('.line-comment');
    var isVisible = lineComment.is(':visible');
    var hasComment = this.model.comment.length > 0;
    var $toggler = this.$el.find(".toggle-line-comment");
    $toggler.find(".show-line-comment").toggleClass('hidden', isVisible);
    $toggler.find(".hide-line-comment").toggleClass('hidden', !isVisible);
    $toggler.toggleClass('btn-default', !hasComment).toggleClass('btn-info', hasComment);
};

LineView.prototype.addTag = function addTag(tag) {
    this.model.addTag(tag);
    this.render();
};

LineView.prototype.onInput = function onInput() {
    this.model.comment = this.$el.find('.line-comment textarea ').val().trim();
    this.model.transcription = this.$el.find('.line-transcription input').val().trim();
    this.renderToggler();
    this.renderTextarea();
    window.app.emit('app:changed');
};

LineView.prototype.render = function() {
    var self = this;
    console.log("Rendering", this.model.id);

    // Build from template
    this.$el.off().find("*").off();
    this.$el.html($(self.tpl(this.model)));

    // data binding
    this.$el.on('input', self.onInput.bind(this));

    // Mark line selected on click in select mode
    this.$el.on('click', function() {
        if (window.app.selectMode) {
            self.selected = !self.selected;
            self.renderCheckbox();
        }
    });

    // Add error tag on click
    this.$el.find("*[data-tag]").on('click', function() {
        self.addTag($(this).attr('data-tag'));
        window.app.emit('app:changed');
    });

    // On clicking the comment toggler
    this.$el.find(".toggle-line-comment").on('click', function() {
        var commentField = self.$el.find('.line-comment');
        commentField.toggleClass('hidden', commentField.is(':visible')).removeClass('view-hidden');
        self.renderToggler();
    });

    // Render the toggle button
    this.renderToggler();

    // Render (or don't) the checkbox
    this.renderCheckbox();

    // Fit height of text area
    this.renderTextarea();

    return this;
};
