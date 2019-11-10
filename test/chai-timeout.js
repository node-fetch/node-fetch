export default ({Assertion}, utils) => {
	utils.addProperty(Assertion.prototype, 'timeout', function () {
		return new Promise(resolve => {
			const timer = setTimeout(() => resolve(true), 150);
			this._obj.then(() => {
				clearTimeout(timer);
				resolve(false);
			});
		}).then(timeouted => {
			this.assert(
				timeouted,
				'expected promise to timeout but it was resolved',
				'expected promise not to timeout but it timed out'
			);
		});
	});
};

