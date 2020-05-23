export default function delay(ms) {
	return value => new Promise(resolve => {
		setTimeout(() => {
			resolve(value);
		}, ms);
	});
}
