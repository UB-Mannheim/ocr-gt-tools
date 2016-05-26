function Line(opts) {
    for (key in opts) { this[key] = opts[key]; }
    this.changed = false;
    this.selected = false;
}

