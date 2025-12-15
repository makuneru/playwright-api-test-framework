import { randomUUID } from 'crypto';

/**
 * Global setup runs once before all test workers start
 * This ensures SESSION_ID is generated once and shared across all workers
 */
async function globalSetup() {
  const sessionId = randomUUID();
  process.env.PLAYWRIGHT_SESSION_ID = sessionId;
  console.log(`\n🔐 Test Session ID: ${sessionId}\n`);
}

export default globalSetup;

