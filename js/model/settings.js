var defaultSettings = {
    zoomInFactor: 1.4,
    zoomOutFactor: 0.8,
    debug: true,
    cgiUrl: 'ocr-gt-tools.cgi',
    defaultViews: ['.transcription','img'],
    animationTimeout: 5000,
    animationsPerRound: 50,
    animationInterval: 100,
};

function Settings(opts) {
    for (let k in defaultSettings) { this[k] = defaultSettings[k]; }
}

Settings.prototype.load = function loadSettings() {
    console.log("NOT IMPLEMENTED");
};

Settings.prototype.save = function loadSettings() {
    console.log("NOT IMPLEMENTED");
};

