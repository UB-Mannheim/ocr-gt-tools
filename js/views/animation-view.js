function WaitingAnimation(opts) {
    for (key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}
WaitingAnimation.prototype.render = function() {
    window.app.on('app:loading', this.start.bind(this));
    window.app.on('app:loaded', this.stop.bind(this));
    window.app.on('app:ajaxError', this.stop.bind(this));
    this.glyphs = [];
    for (var i = 0; i <  this.model.items.length; i++) {
        for (var j = 0 ; j < this.model.items[i].sample.length; j++) {
            this.glyphs.push(this.model.items[i].sample[j]);
        }
    }
};

WaitingAnimation.prototype.stop = function stopWaitingAnimation() {
    this.$el.addClass('hidden');
    this.$el.empty();
    clearInterval(this.animationId);
    clearTimeout(this.timeoutId);
};

WaitingAnimation.prototype.start = function startWaitingAnimation() {
    var self = this;
    this.$el.removeClass('hidden');
    this.animationId = setInterval(function() {
        perRound = window.app.settings.animationsPerRound;
        while (perRound-- > 0) {
            $(self.glyphs[parseInt(Math.random() * self.glyphs.length)])
                .css('top', parseInt(Math.random() * 100) + "vh")
                .css('left', parseInt(Math.random() * 100) + "vw")
                .appendTo(self.$el) ;
        }
    }, window.app.settings.animationInterval);
    this.timeoutId = setTimeout(function timeoutAnimation() {
        console.error("Animation ran too long, stopping it");
        notie.alert(3, "Loading took more than " +
                    (window.app.settings.animationTimeout / 1000) +
                    " seconds. Please see the console for possible errors");
        clearInterval(self.animationId);
    }, window.app.settings.animationTimeout);
};
