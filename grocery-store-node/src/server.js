import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { config } from './config/index.js';
import { createContainer } from './container.js';

async function main() {
  const container = createContainer(config);

  try {
    await connectDatabase(config.mongoUri);
  } catch (error) {
    const safeUri = config.mongoUri.replace(/\/\/[^@/]*@/, '//'); // never print credentials
    console.error(`Could not connect to MongoDB at ${safeUri}: ${error.message}`);
    console.error('Is MongoDB running?');
    process.exit(1);
  }

  await container.databaseSeeder.run();

  const app = createApp(container);
  app.listen(config.port, (error) => {
    if (error) {
      console.error(`Could not listen on port ${config.port}: ${error.message}`);
      process.exit(1);
    }
    console.log(`API listening on http://localhost:${config.port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
