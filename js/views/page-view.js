function PageView(opts) {
    for (key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
}
PageView.prototype.render = function() {
    console.log(this.model);
    for (var i = 0; i < this.model['line-transcriptions'].length; i++)  {
        var line = {
            transcription: this.model['line-transcriptions']
        };
        var $line = $(this.tpl(line));
        $line.find(":checkbox").on('click', function(e) {
            $(this).closest('.row').toggleClass('selected');
            e.stopPropagation();
        });
        $line.find(".select-col").on('click', function(e) {
            $(this).find(':checkbox').click();
        });
        $line.find(".transcription div[contenteditable]").on('keydown', function(e) {
            if (e.keyCode == 13) {
                e.preventDefault();
            }
        });
        $line.find("div[contenteditable]").on('blur', function(e) {
            $(this).html(Utils.encodeForBrowser(Utils.encodeForServer($(this).html())));
        });
        this.$el.append($line);
    }
};
