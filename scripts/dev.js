const { spawn } = require('child_process');
const { createServer } = require('net');

function waitForPort(port, host = 'localhost') {
  return new Promise((resolve) => {
    const check = () => {
      const socket = new createServer();
      const client = require('net').createConnection({ port, host }, () => {
        client.end();
        resolve();
      });
      client.on('error', () => {
        setTimeout(check, 300);
      });
    };
    check();
  });
}

async function main() {
  // Start Vite
  const vite = spawn('npx', ['vite'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env },
  });

  // Compile TypeScript for electron
  const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.electron.json', '--watch'], {
    stdio: 'inherit',
    shell: true,
  });

  // Wait for Vite to be ready
  console.log('Waiting for Vite dev server...');
  await waitForPort(5173);
  console.log('Vite ready, starting Electron...');

  // Start Electron
  const electron = spawn('npx', ['electron', '.'], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      VITE_DEV_SERVER_URL: 'http://localhost:5173',
    },
  });

  electron.on('close', () => {
    vite.kill();
    tsc.kill();
    process.exit();
  });

  process.on('SIGINT', () => {
    electron.kill();
    vite.kill();
    tsc.kill();
    process.exit();
  });
}

main();
