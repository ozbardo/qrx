import {createServer} from 'http';
import {writeFile, readFile, mkdir} from 'fs/promises';
import {join, dirname, resolve} from 'path';
const PORT = 3000;
const DATA_DIR = resolve(join(process.cwd(), 'data'));
const SECRET = process.env.QRX_SECRET_KEY;
// Loaded via node --env-file=.env
const clients = new Set();
createServer((req, res) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	if (req.method === 'OPTIONS') return res.writeHead(204).end();
	const url = new URL(req.url, `http://localhost`);
	// ROUTE: SSE Radio Tower
	if (req.method === 'GET' && url.pathname === '/stream') {
		// Auth check via query param for EventSource
		if (SECRET && url.searchParams.get('auth') !== SECRET) return res.writeHead(401).end();
		res.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		});
		clients.add(res);
		req.on('close', () => clients.delete(res));
		return;
	} // Auth check for all POST routes
	if (req.method === 'POST') {
		if (SECRET && req.headers.authorization !== SECRET) {
			return res.writeHead(401).end(JSON.stringify({
				error: 'Unauthorized'
			}));
		}
	} // ROUTE: POST /write
	if (req.method === 'POST' && url.pathname === '/write') {
		let body = '';
		req.on('data', chunk => body += chunk.toString());
		req.on('end', async () => {
			try {
				const {
					namespace,
					key,
					value,
					clientId
				} = JSON.parse(body);
				const targetPath = resolve(join(DATA_DIR, namespace, key));
				if (!targetPath.startsWith(DATA_DIR)) throw new Error("Path traversal blocked");
				await mkdir(dirname(targetPath), {
					recursive: true
				});
				await writeFile(targetPath, value || '');


				// Broadcast the update AND the clientId that caused it
				const msg = `data: ${JSON.stringify({ namespace, key, clientId })}\n\n`;

				clients.forEach(client => client.write(msg));

				res.writeHead(200).end(JSON.stringify({
					status: 'saved'
				}));
			} catch (err) {
				res.writeHead(400).end(JSON.stringify({
					error: err.message
				}));
			}
		});
		return;
	}

	// ROUTE: POST /read (Implementation remains same, but now protected by the POST auth block above)
	if (req.method === 'POST' && url.pathname === '/read') {
		let body = '';
		req.on('data', chunk => body += chunk.toString());
		req.on('end', async () => {
			try {
				const {
					namespace,
					key
				} = JSON.parse(body);
				const targetPath = resolve(join(DATA_DIR, namespace, key));
				if (!targetPath.startsWith(DATA_DIR)) throw new Error("Path traversal blocked");

				const data = await readFile(targetPath, 'utf-8');
				res.writeHead(200).end(JSON.stringify({
					value: data
				}));
			} catch (err) {
				res.writeHead(404).end(JSON.stringify({
					error: 'Not found'
				}));
			}
		});
		return;

	}

}).listen(PORT, () => console.log(`Fog Node active on http://localhost:${PORT}`));
