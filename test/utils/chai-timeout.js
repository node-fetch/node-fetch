export default ({Assertion}, utils) => {
	utils.addProperty(Assertion.prototype, 'timeout', async function () {
		const timeout = Symbol('timeout');
		const result = await Promise.race([
			this._obj,
			new Promise(resolve => {
				setTimeout(resolve, 150, timeout);
			})
		]);

		return this.assert(
			result === timeout,
			'expected promise to timeout but it was resolved',
			'expected promise not to timeout but it timed out'
		);
	});
};
