function LineView(opts) {
    for (var key in opts) { this[key] = opts[key]; }
    this.tpl = window.app.templates.line;
}

/**
 * Update the color of the comment toggle button depending on whether line has
 * comments or not.
 */
LineView.prototype.renderComment = function renderComment() {

    // Comment toggler
    var lineComment = this.$el.find('.line-comment');
    var isVisible = lineComment.is(':visible');
    var hasComment = this.model.comment.length > 0;
    var $toggler = this.$el.find(".toggle-line-comment");
    $toggler.find(".show-line-comment").toggleClass('hidden', isVisible);
    $toggler.find(".hide-line-comment").toggleClass('hidden', !isVisible);
    $toggler.toggleClass('btn-default', !hasComment).toggleClass('btn-info', hasComment);

    // Selectionmode
    this.$el.find('.select-col').toggleClass('hidden', !window.app.selectMode);
    this.$el.find('.button-col').toggleClass('hidden', window.app.selectMode);
    this.$el.toggleClass('selected', this.selected);
    this.$el.find(':checkbox').prop('checked', this.selected);
};

// LineView.prototype.setSelected = function setSelected(selected) {
//     this.selected = selected;
//     this.renderComment();
// };

LineView.prototype.onEnterSelectMode = function onEnterSelectMode() {
    var self = this;
    this.$el.on('click', function() {
        self.selected = !self.selected;
        self.renderComment();
    });
    self.renderComment();
};

LineView.prototype.onExitSelectMode = function onExitSelectMode() {
    this.$el.off('click');
    this.renderComment();
};

LineView.prototype.addTag = function addTag(tag) {
    this.model.addTag(tag);
    this.renderComment();
};

LineView.prototype.render = function() {
    var self = this;
    console.log("Rendering", this.model.id);
    this.$el.off().find("*").off();
    // Build from template
    this.$el.html($(self.tpl(this.model)));

    var lineComment = self.$el.find('.line-comment textarea');

    this.$el.find(".toggle-line-comment").on('click', function() {
        var commentField = self.$el.find('.line-comment');
        commentField.toggleClass('hidden', commentField.is(':visible')).removeClass('view-hidden');
        self.renderComment();
    });

    // data binding
    this.$el.find("input,textarea").on('input', function(e) {
        self.model.comment = lineComment.val().trim();
        self.model.transcription = self.$el.find('.line-transcription input').val().trim();
        // self.renderComment();
        Utils.fitHeight(lineComment);
        // console.log(self.selected);
        // window.app.emit('app:changed');
    });

    // Add error tag on click
    this.$el.find("*[data-tag]").on('click', this.addTag.bind(this));

    // this.renderComment();
    Utils.fitHeight(lineComment);
    window.app.once('app:loaded', function() { Utils.fitHeight(lineComment); });
    window.app.once('app:loaded', this.renderComment.bind(this));
    window.app.on('app:filter-view', this.renderComment.bind(this));
    window.app.on('app:enter-select-mode', this.onEnterSelectMode.bind(this));
    window.app.on('app:exit-select-mode', this.onExitSelectMode.bind(this));

    return this;
};
