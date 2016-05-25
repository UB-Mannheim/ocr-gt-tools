function PageView(opts) {
    for (key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}
