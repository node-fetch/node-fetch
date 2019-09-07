export default function tweakDefault() {
	return {
		transformBundle(source) {
			const lines = source.split('\n');
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const matches = /^(exports(?:\['default']|\.default)) = (.*);$/.exec(line);
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
