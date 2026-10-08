import { createAuthService } from './services/authService.js';
import { createAccessService } from './services/accessService.js';
import { createEmployeeService } from './services/employeeService.js';
import { createEmployeeRepository } from './repositories/employeeRepository.js';
import { createNodeRepository } from './repositories/nodeRepository.js';
import { createJwtService } from './security/jwtService.js';
import { createPasswordEncoder } from './security/passwordEncoder.js';
import { createDatabaseSeeder } from './seeder/databaseSeeder.js';

/**
 * Creates every object of the application and connects them to each other.
 *
 * Spring does this for you (@Service, @Autowired, constructor injection). In Node we do it by hand,
 * in one place: each "create..." function receives what it needs as an argument. The big advantage
 * is in the tests, where we hand the services fake repositories instead of a real database.
 */
export function createContainer(config) {
  const nodeRepository = createNodeRepository();
  const employeeRepository = createEmployeeRepository();

  const passwordEncoder = createPasswordEncoder();
  const jwtService = createJwtService(config.jwt);

  const accessService = createAccessService({ employeeRepository, nodeRepository });
  const authService = createAuthService({ employeeRepository, passwordEncoder, jwtService });
  const employeeService = createEmployeeService({ employeeRepository, accessService, passwordEncoder });

  const databaseSeeder = createDatabaseSeeder({
    nodeRepository,
    employeeRepository,
    passwordEncoder,
    enabled: config.seed.enabled,
    reset: config.seed.reset,
  });

  return {
    nodeRepository,
    employeeRepository,
    jwtService,
    accessService,
    authService,
    employeeService,
    databaseSeeder,
  };
}
