var WaitingAnimation = (function WaitingAnimation() {
    var self = this;
    self._id = null;
    this.start = function startWaitingAnimation() {
        $("#dropzone").addClass('hidden');
        $("#waiting-animation").removeClass('hidden');
        var keys = Object.keys(UISettings['special-chars']);
        self._id = setInterval(function() {
            perRound = 50;
            while (perRound-- > 0) {
                var randGlyph = UISettings['special-chars'][keys[parseInt(Math.random() * keys.length)]];
                var $el = $("#waiting-animation" +
                    " tr:nth-child(" + parseInt(Math.random() * 20) + ")" +
                    " td:nth-child(" + parseInt(Math.random() * 20) + ")"
                ).html(randGlyph.sample);
            }
        }, 300);
    };
    this.stop = function stopWaitingAnimation() {
        $("#waiting-animation").addClass('hidden');
        clearInterval(self._id);
    };
    return self;
})();

