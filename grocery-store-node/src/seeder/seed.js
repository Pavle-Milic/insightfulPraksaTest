// Stand-alone database initialization script:
//   npm run seed          fills an empty database (does nothing if it already has data)
//   npm run seed:reset    wipes the nodes and employees collections and fills them again

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { config } from '../config/index.js';
import { createContainer } from '../container.js';

const reset = process.argv.includes('--reset');
const container = createContainer({ ...config, seed: { enabled: true, reset } });

try {
  await connectDatabase(config.mongoUri);
  await container.databaseSeeder.run();
} catch (error) {
  console.error(`Seeding failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
