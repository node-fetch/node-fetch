export default ({Assertion}, utils) => {
	utils.addProperty(Assertion.prototype, 'timeout', async function () {
		const timeouted = await Promise.race([this._obj.then(() => false), new Promise(resolve => {
			setTimeout(() => resolve(true), 150);
		})]);
		return this.assert(
			timeouted,
			'expected promise to timeout but it was resolved',
			'expected promise not to timeout but it timed out'
		);
	});
};
