import { buildEmployees, buildNodes, DEFAULT_PASSWORD, ORG_TREE } from './orgTree.js';

/**
 * Fills the database with mock data: the org tree from the task diagram, and for every node
 * 1 manager + 2 employees.
 *
 * By default it does nothing if the database already has data, so it never overwrites anything
 * created through the API. With reset = true it wipes both collections and reseeds.
 */
export function createDatabaseSeeder({
  nodeRepository,
  employeeRepository,
  passwordEncoder,
  enabled = true,
  reset = false,
  logger = console,
}) {
  async function run() {
    if (!enabled) {
      logger.log('Seeding disabled (SEED_ENABLED=false)');
      return;
    }

    const hasData = (await nodeRepository.count()) > 0 || (await employeeRepository.count()) > 0;
    if (hasData && !reset) {
      logger.log('Database already contains data, skipping seeding (use "npm run seed:reset" to wipe and reseed)');
      return;
    }
    if (hasData) {
      await employeeRepository.deleteAll();
      await nodeRepository.deleteAll();
      logger.log('Existing data wiped (reset requested)');
    }

    const nodes = buildNodes(ORG_TREE, nodeRepository.newId);

    // BCrypt is deliberately slow, so hash once and reuse the result for all mock users
    const passwordHash = await passwordEncoder.encode(DEFAULT_PASSWORD);
    const employees = buildEmployees(nodes, passwordHash);

    await nodeRepository.saveAll(nodes);
    await employeeRepository.saveAll(employees);

    logger.log(
      `Seeded ${nodes.length} nodes and ${employees.length} employees (login e.g. srbija.manager1 / ${DEFAULT_PASSWORD})`,
    );
  }

  return { run };
}
