export default function tweakDefault() {
  return {
    transformBundle: function (source) {
      var lines = source.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var matches = /^(exports(?:\['default']|\.default)) = (.*);$/.exec(line);
        if (matches) {
          lines[i] = 'module.exports = exports = ' + matches[2] + ';\n' +
                     'Object.defineProperty(exports, "__esModule", { value: true });\n' +
                     matches[1] + ' = exports;';
          break;
        }
      }
      return lines.join('\n');
    }
  };
}
