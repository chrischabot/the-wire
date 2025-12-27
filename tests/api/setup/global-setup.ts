import { spawn, ChildProcess } from 'child_process';

let wranglerProcess: ChildProcess | null = null;

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8787';

async function waitForServer(url: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        console.log(`Server is ready at ${url}`);
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Server failed to start at ${url} after ${maxAttempts} attempts`);
}

async function resetDatabase(url: string): Promise<void> {
  try {
    const response = await fetch(`${url}/debug/reset`, { method: 'POST' });
    if (!response.ok) {
      console.warn(`Warning: Database reset returned ${response.status}`);
    } else {
      console.log('Database reset successful');
    }
  } catch (error) {
    console.warn('Warning: Could not reset database:', error);
  }
}

export async function setup(): Promise<() => Promise<void>> {
  console.log('Starting wrangler dev server...');

  // Start wrangler dev server
  wranglerProcess = spawn('npx', ['wrangler', 'dev', '--port', '8787'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  // Log wrangler output for debugging
  wranglerProcess.stdout?.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Ready') || output.includes('error')) {
      console.log('[wrangler]', output.trim());
    }
  });

  wranglerProcess.stderr?.on('data', (data) => {
    console.error('[wrangler error]', data.toString().trim());
  });

  // Wait for server to be ready
  await waitForServer(BASE_URL);

  // Reset database to clean state
  await resetDatabase(BASE_URL);

  // Return teardown function
  return async () => {
    console.log('Stopping wrangler dev server...');
    if (wranglerProcess) {
      wranglerProcess.kill('SIGTERM');
      wranglerProcess = null;
    }
  };
}
