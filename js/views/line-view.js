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
LineView.prototype.updateCommentButtonColor = function updateCommentButtonColor() {
    var toggler = this.$el.find(".toggle-line-comment");
    if (this.model.comment.length > 0)
        toggler.removeClass('btn-default').addClass('btn-info');
    else
        toggler.addClass('btn-default').removeClass('btn-info');
};

LineView.prototype.render = function() {
    var self = this;
    // Build from template
    this.$el.empty().html($(window.app.templates.line(this.model)));

    // updateCommentButtonColor
    window.app.on('app:changed', this.updateCommentButtonColor.bind(this));
    this.updateCommentButtonColor();

    this.$el.find(".toggle-line-comment").on('click', function() {
        self.$el.find(".line-comment").toggleClass("view-hidden");
        self.$el.find(".toggle-line-comment").toggleClass("hidden");
    });

    // data binding
    this.$el.find("input,textarea").on('input', function(e) {
        self.model.comment = self.$el.find('.line-comment textarea').val().trim();
        self.model.transcription = self.$el.find('.line-transcription input').val().trim();
        window.app.emit('app:changed');
    });

    // Add error tag on click
    this.$el.find("*[data-tag]").on('click', function(e) {
        var tag = $(this).attr('data-tag');
        if (self.model.addTag(tag)) {
            self.$el.removeClass('hidden');
            self.render();
            window.app.emit('app:changed');
        }
    });

    this.$el.find(":checkbox").on('click', function(e) {
        if (!window.app.selectMode) return;
        $(this).closest('.row').toggleClass('selected');
        e.stopPropagation();
    });
    this.$el.on('click', function(e) {
        if (!window.app.selectMode) return;
        $(this).find(':checkbox').click();
    });
    return this;
};
