export default {
	files: ['test-new/**', '!test-new/utils'],
	ignoredByWatcher: ['{coverage,docs,test-new,@types}/**'],
	nodeArguments: [
		'--experimental-modules'
	]
};
