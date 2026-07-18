import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createConnection } from 'node:net';

const root = process.cwd();
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function isPortFree(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.once('connect', () => finish(false));
    socket.once('error', () => finish(true));
  });
}

async function findPort() {
  const preferredPort = Number(process.env.PORT || 3000);
  for (let port = preferredPort; port < preferredPort + 20; port += 1) {
    if (await isPortFree(port)) {
      return port;
    }
  }

  throw new Error('No free port found');
}

function sendFile(res, filePath) {
  const body = readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
  });
  res.end(body);
}

const port = await findPort();

const server = createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const targetPath = normalize(join(root, requestPath === '/' ? '/index.html' : requestPath));

  if (!targetPath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    let filePath = targetPath;
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, 'index.html');
    }

    sendFile(res, filePath);
  } catch {
    sendFile(res, join(root, 'index.html'));
  }
});

server.listen(port, () => {
  console.log(`http://127.0.0.1:${port}`);
});