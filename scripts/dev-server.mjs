import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createConnection } from 'node:net';

// 静的ファイルを配信する最小限の開発サーバー
const root = process.cwd();
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

// 指定ポートが使用中かを確認する
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

// 優先ポートから順に空きを探す
async function findPort() {
  const preferredPort = Number(process.env.PORT || 3000);
  for (let port = preferredPort; port < preferredPort + 20; port += 1) {
    if (await isPortFree(port)) {
      return port;
    }
  }

  throw new Error('No free port found');
}

// 拡張子に応じたContent-Typeでファイルを返す
function sendFile(res, filePath) {
  const body = readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
  });
  res.end(body);
}

const port = await findPort();

// ルーティングは実質1本。存在しないパスは index.html にフォールバックする
const server = createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const targetPath = normalize(join(root, requestPath === '/' ? '/index.html' : requestPath));

  // root の外へ出るパスは拒否する
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
    // どのファイルにも一致しない場合は SPA 風に index.html を返す
    sendFile(res, join(root, 'index.html'));
  }
});

// 起動先URLを表示する
server.listen(port, () => {
  console.log(`http://127.0.0.1:${port}`);
});