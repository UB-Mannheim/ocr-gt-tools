function PageView(opts) {
    for (let key in opts) { this[key] = opts[key]; }
    this.$el = $(this.el);
    this.lineViews = [];
}

/**
 * Sort the rows by image width
 *
 * @param {number} order Sort descending (-1) or ascending (1, default)
 */
PageView.prototype.sortRowsByWidth = function sortRowsByWidth(order) {
    var order = order || 1;
    this.$el.html(
        this.$el.find(".row").sort(function(a, b) {
            var aWidth = Utils.getImageWidth(a);
            var bWidth = Utils.getImageWidth(b);
            return (aWidth - bWidth) * order;
        }).detach()
    );
};

/**
 * Sort the rows by line number
 *
 * @param {number} order Sort descending (-1) or ascending (1, default)
 */
PageView.prototype.sortRowsByLine = function sortRowsByLine(order) {
    var order = order || 1;
    this.$el.html(
        this.$el.find(".row").sort(function(a, b) {
            var aLine = $(a).attr('id').replace(/[^\d]/g, '');
            var bLine = $(b).attr('id').replace(/[^\d]/g, '');
            return (aLine - bLine) * order;
        }).detach()
    );
};

PageView.prototype.render = function() {
    this.$el.find('*').off().empty();
    // render lines
    for (let i = 0; i < this.model.lines.length; i++)  {
        var lineModel = this.model.lines[i];
        var lineEl = $(window.app.templates.lineContainer(lineModel)).appendTo(this.$el);
        var lineView = new LineView({"$el": lineEl, "model": lineModel});
        lineView.render();
        this.lineViews.push(lineView);
    }
};
