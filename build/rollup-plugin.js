export default function tweakDefault() {
  return {
    transformBundle: function (source) {
      var lines = source.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var matches = /^exports\['default'] = (.*);$/.exec(line);
        if (matches) {
          lines[i] = 'module.exports = exports = ' + matches[1] + ';';
          break;
        }
      }
      return lines.join('\n');
    }
  };
}
