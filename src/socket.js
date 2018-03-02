const tls = require('tls');
const http = require('http');
const https = require('https');
// lazy require http2 because it emits a warning
let http2;
const hasHttp2 = require('repl')._builtinLibs.includes('http2');

const ALPNProtocols = hasHttp2 ? ['h2', 'http/1.1'] : ['http/1.1'];

function connectHttp(Promise, opt, onSocket, onReq) {
	const req = http.request(opt);
	req.on('socket', onSocket);
	onReq(null, { req });
}

function connectHttps(Promise, opt, onSocket, onReq) {
	const port = +opt.port || 443;
	const socket = tls.connect({
		host: opt.host
		, port
		, servername: opt.host
		, ALPNProtocols,
	});
	socket.once('secureConnect', () => {
		onSocket(socket);
		switch (socket.alpnProtocol) {
			case false:
			case 'http/1.1': {
				const req = https.request(Object.assign({
					createConnection: () => socket,
				}, opt));
				onReq(null, { req });
				break;
			}
			case 'h2': {
				if (http2 === undefined)
					http2 = require('http2');

				const connection = http2.connect({
					host: opt.host
					, port,
				}, {
					createConnection: () => socket,
				});
				const req = connection.request(Object.assign({
					':path': opt.path
					, ':method': opt.method
					, ':authority': opt.host,
				}, opt.headers));
				onReq(null, { req, http2: true });
				break;
			}
			default:
				onReq(new Error('No supported ALPN protocol was negotiated'));
				break;
		}
	});
}

export default function(Promise, options, onSocket, onReq) {
	return (options.protocol === 'https:' ? connectHttps : connectHttp)(Promise, options, onSocket, onReq);
}
