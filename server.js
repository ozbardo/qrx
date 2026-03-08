import { createServer } from 'http';
import { writeFile, readFile, mkdir, stat, readdir } from 'fs/promises';
import { join, dirname, resolve, extname } from 'path';
import { createReadStream } from 'fs';

const PORT = 3000;
const DATA_DIR = resolve(join(process.cwd(), 'public', 'data'));
const DIST_DIR = resolve(join(process.cwd(), 'dist'));
const SECRET = process.env.QRX_SECRET_KEY;
const clients = new Set();

// Deeply recurses through all namespaces and nested folders to map the entire dataverse
async function updateDataIndex() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    let results = [];
    const namespaces = await readdir(DATA_DIR, { withFileTypes: true });
    
    for (let ns of namespaces) {
      if (!ns.isDirectory()) continue;
      
      async function walk(currentDir, currentPath) {
        const entries = await readdir(currentDir, { withFileTypes: true });
        for (let e of entries) {
          if (e.name === '.DS_Store') continue;
          const itemPath = currentPath ? `${currentPath}/${e.name}` : e.name;
          
          if (e.isDirectory()) {
            await walk(join(currentDir, e.name), itemPath);
          } else {
            results.push(`${ns.name}/${itemPath}`);
          }
        }
      }
      
      await walk(join(DATA_DIR, ns.name), '');
    }
    await writeFile(join(DATA_DIR, 'index.json'), JSON.stringify(results));
  } catch (err) {
    console.error('Failed to generate data index:', err);
  }
}

updateDataIndex();

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  
  const url = new URL(req.url, `http://localhost`);
  
  // OPEN STREAM: Anyone can connect as a reader to see live updates
  if (req.method === 'GET' && url.pathname === '/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.method === 'GET') {
    let safePath = url.pathname === '/' ? 'index.html' : url.pathname;
    let filePath;

    if (safePath.startsWith('/data/')) {
      filePath = resolve(join(DATA_DIR, safePath.replace(/^\/data\//, '')));
      if (!filePath.startsWith(DATA_DIR)) return res.writeHead(403).end('Forbidden');
      try { await stat(filePath); } catch { return res.writeHead(404).end('Not Found'); }
    } else {
      filePath = resolve(join(DIST_DIR, safePath));
      if (!filePath.startsWith(DIST_DIR)) return res.writeHead(403).end('Forbidden');
      
      try {
        const fileStat = await stat(filePath);
        if (fileStat.isDirectory()) throw new Error('is_dir');
      } catch {
        if (!extname(safePath)) {
          filePath = resolve(join(DIST_DIR, 'index.html'));
        } else {
          return res.writeHead(404).end('Not Found');
        }
      }
      try { await stat(filePath); } catch { return res.writeHead(404).end('Not Found'); }
    }

    const mimes = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
    res.writeHead(200, { 'Content-Type': mimes[extname(filePath)] || 'application/octet-stream' });
    
    const stream = createReadStream(filePath);
    stream.on('error', () => { if (!res.headersSent) res.writeHead(500).end(); });
    stream.pipe(res);
    return;
  }

  // ROUTE: Live Write (PROTECTED)
  if (req.method === 'POST' && url.pathname === '/write') {
    if (SECRET && req.headers.authorization !== SECRET) {
      return res.writeHead(401).end(JSON.stringify({ error: 'Unauthorized' }));
    }

    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { namespace, key, value, clientId } = JSON.parse(body);
        const targetPath = resolve(join(DATA_DIR, namespace, key));
        if (!targetPath.startsWith(DATA_DIR)) throw new Error("Path traversal blocked");
        
        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, value || '');
        
        await updateDataIndex();

        const msg = `data: ${JSON.stringify({ namespace, key, clientId })}\n\n`;
        clients.forEach(client => client.write(msg));

        res.writeHead(200).end(JSON.stringify({ status: 'saved' }));
      } catch (err) {
        res.writeHead(400).end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ROUTE: POST /read (Now with native 'main' cascade)
	if (req.method === 'POST' && url.pathname === '/read') {
		let body = '';
		req.on('data', chunk => body += chunk.toString());
		req.on('end', async () => {
			try {
				const { namespace, key } = JSON.parse(body);
				let targetPath = resolve(join(DATA_DIR, namespace, key));
				if (!targetPath.startsWith(DATA_DIR)) throw new Error("Path traversal blocked");

				let data;
				try {
					// 1. Try to read the exact namespace
					data = await readFile(targetPath, 'utf-8');
				} catch (err) {
					// 2. The Cascade: If it fails and we aren't in 'main', try 'main'
					if (namespace !== 'main') {
						targetPath = resolve(join(DATA_DIR, 'main', key));
						if (!targetPath.startsWith(DATA_DIR)) throw new Error("Path traversal blocked");
						data = await readFile(targetPath, 'utf-8');
					} else {
						// It actually doesn't exist anywhere
						throw err; 
					}
				}

				res.writeHead(200).end(JSON.stringify({ value: data }));
			} catch (err) {
				res.writeHead(404).end(JSON.stringify({ error: 'Not found' }));
			}
		});
		return;
	}

  res.writeHead(404).end('Not Found');
}).listen(PORT, '0.0.0.0', () => console.log(`Fog Node active on http://0.0.0.0:${PORT}`));
