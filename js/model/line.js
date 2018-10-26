function Line(opts) {
    for (let key in opts) { this[key] = opts[key]; }
    this.changed = false;
}

Line.prototype.getTags = function getTags() {
    var ret = {};
    this.comment.replace(/(#[a-z0-9-]+)\s*([^\n#]+)?/g, function(_, tag, desc) {
        ret[tag] = desc;
    });
    return ret;
};

Line.prototype.addTag = function addTag(tag, desc) {
    desc = desc || '';
    if (this.getTags().hasOwnProperty(tag)) {
        console.info("Already has this tag: " + tag);
        return;
    }
    this.comment = (this.comment.trim() + "\n" + tag.trim() + " " + desc.trim()).trim();
    return true;
};
