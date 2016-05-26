function LineView(opts) {
    for (key in opts) { this[key] = opts[key]; }
}


// TODO
function addComment() {
    var target = $($(this).attr('data-target')).find('div[contenteditable]');
    var tag = '#' + $(this).attr('data-tag');
    addTagToElement($(target), tag);
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

LineView.prototype.render = function() {
    var self = this;
    // Build from template
    this.$el.find("*").off().addBack().off().html($(window.app.templates.line(this.model)));

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

    // Click handler for multi-select
    this.$el.find(":checkbox").on('click', function(e) {
        if (!window.app.selectMode) return;
        $(this).closest('.row').toggleClass('selected');
        e.stopPropagation();
    });

    // Click handler for multi-select
    this.$el.on('click', function(e) {
        if (!window.app.selectMode) return;
        $(this).find(':checkbox').click();
    });

    // Adapt the textarea height
    Utils.fitHeight(this.$el.find('textarea'));

    // Highlight button w/ comments
    window.app.on('app:filter-view', this.renderCommentToggler.bind(this));
    this.renderCommentToggler();

    return this;
};
