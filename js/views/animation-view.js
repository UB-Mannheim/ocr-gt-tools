function WaitingAnimation(opts) {
    for (key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}
WaitingAnimation.prototype.stop = function stopWaitingAnimation() {
    this.$el.addClass('hidden');
    clearInterval(this._id);
};
WaitingAnimation.prototype.start = function startWaitingAnimation() {
    var self = this;
    this.$el.removeClass('hidden');
    var items = self.model.items;
    this._id = setInterval(function() {
        perRound = 5;
        while (perRound-- > 0) {
            var randGlyph = items[parseInt(Math.random() * items.length)];
            $(self.el +
              " tr:nth-child(" + parseInt(Math.random() * 20) + ")" +
              " td:nth-child(" + parseInt(Math.random() * 20) + ")"
             ).html(randGlyph.sample);
        }
    }, 300);
};
