function Dropzone(opts) {
    for (var key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}
Dropzone.prototype.render = function() {
    var self = this;

    $("#load-image button").on('click', function() {
        window.location.hash = '#' + $("#load-image input").val();
    });

    window.app.on('app:loading', function hideDropzone() { self.$el.addClass('hidden'); });

};
