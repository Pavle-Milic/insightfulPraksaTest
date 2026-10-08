# Insightful Test

Insightful internship test. Node.js (Express) backend + MongoDB.

## Requirements

For local development:

- Node.js 22+
- MongoDB running on `localhost:27017`

For the reviewer-friendly Docker setup, Docker with Docker Compose is enough.

## Run locally

```bash
npm install
npm start
```

The API listens on `http://localhost:8080`. For auto-restart on file changes use `npm run dev`.

## Run with Docker

The easiest way to run the complete application is Docker Compose. It starts MongoDB, waits for MongoDB
to become healthy, then starts the Node.js API, which also serves the frontend.

```bash
docker compose up --build
```

or without unnecesairy logs

```bash
docker compose up --build -d
docker compose logs -f app
```

Then open `http://localhost:8080`. To stop everything, press `Ctrl+C`. To remove the database volume as well:

```bash
docker compose down -v
```

On startup the app creates the `Insightful_Test` database and fills it with mock data
(23 nodes, 69 people: 1 manager + 2 employees per node). Seeding is skipped if the
database already contains data.

All mock users have the password `password123`. Usernames follow the pattern
`<nodename>.<role><n>`, e.g. `srbija.manager1`, `novisad.employee2`, `radnja6.manager1`,
`novibeograd.manager1` (node name lowercased, spaces removed).

### Database initialization script

Besides the automatic seeding on startup, the data can be created with a stand-alone script:

```bash
npm run seed          # fills an empty database (does nothing if it already has data)
npm run seed:reset    # wipes the nodes and employees collections and fills them again
```

## Tests

```bash
npm test
```

Unit tests use the built-in Node.js test runner (`node:test`), so they need no extra packages and no
running database. The services receive their repositories as arguments, so the tests hand them
in-memory fakes. The tests run against the real org tree from the task (23 nodes), and cover the
access rules, authentication, request validation, the middleware and the seeder.

## Data model

Two collections:

- `nodes`: `{ _id, name, type: OFFICE | STORE, parentId, ancestors: [ids] }`.
  `ancestors` lists every node above the current one (root first), so *all descendants of X* are found
  with a single indexed query, `{ ancestors: X }`, no recursion needed.
- `employees`: `{ _id, name, username (unique), password (BCrypt hash), role: MANAGER | EMPLOYEE, nodeId }`.
  Employees and managers share one collection, told apart by `role`. Every person belongs to exactly one node.

## Project layout

```
src/
├── server.js        entry point: connects to MongoDB, seeds, starts the HTTP server
├── app.js           builds the Express app (middleware + routes, in order)
├── container.js     creates all objects and wires them together (dependency injection by hand)
├── config/          environment configuration, database connection
├── controllers/     HTTP routes (auth, nodes, employees)
├── dto/             response mappers and request validation schemas (zod)
├── middleware/      JWT authentication, error handling
├── models/          Mongoose schemas (Node, Employee)
├── repositories/    database access, return plain objects
├── security/        JWT signing/verification, password hashing
├── seeder/          mock data and the seed script
├── services/        business logic and access rules
└── utils/           HttpError, ObjectId helpers
test/                unit tests and in-memory fakes
```

## API

Everything under `/api` except login needs the header `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Body `{"username": "...", "password": "..."}`. Returns the token and basic user info |
| GET | `/api/nodes` | The whole tree (id, name, type, parentId), for drawing it |
| GET | `/api/nodes/visible` | Ids of the nodes the logged-in user may access (own node and all descendants) |
| GET | `/api/nodes/:id` | One node: `404` if it doesn't exist, `403` if the user may not access it |
| GET | `/api/nodes/:id/employees` | People with role EMPLOYEE that belong to this node (descendants not included) |
| GET | `/api/nodes/:id/employees/with-descendants` | Employees of this node **and** all its descendants |
| GET | `/api/nodes/:id/managers` | People with role MANAGER that belong to this node. Managers only |
| GET | `/api/nodes/:id/managers/with-descendants` | Managers of this node **and** all its descendants. Managers only |
| POST | `/api/employees` | Creates an employee or a manager (managers only). `201` on success |
| GET | `/api/employees/:id` | One person |
| PUT | `/api/employees/:id` | Replaces name, username, role and nodeId of a person (managers only) |
| DELETE | `/api/employees/:id` | Deletes a person (managers only). `204` on success |

Try it:

```bash
TOKEN=$(curl -s -X POST localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"novibeograd.manager1","password":"password123"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')

curl -H "Authorization: Bearer $TOKEN" localhost:8080/api/nodes/visible   # Novi Beograd, Bezanija, Radnja 6
curl -H "Authorization: Bearer $TOKEN" localhost:8080/api/nodes           # whole tree

# employees of Novi Beograd + Bezanija + Radnja 6 (NODE_ID taken from GET /api/nodes)
curl -H "Authorization: Bearer $TOKEN" localhost:8080/api/nodes/$NODE_ID/employees/with-descendants
```

Without a token, or with a wrong one, `/api` returns `401`. Errors have the shape
`{ timestamp, status, error, message, path }`.

### Who may do what

- Everyone logged in sees the whole tree, but can open only their own node and its descendants (`403` otherwise).
- **Managers** see and manage the employees *and* managers of their own node and its descendants.
  Example: the manager of Novi Beograd sees and manages the people of Novi Beograd, Bezanija and Radnja 6.
- **Employees** see only the *employees* of their own node and its descendants. They get `403` on the managers
  endpoints and when requesting a manager by id.
- `POST`, `PUT` and `DELETE`: the caller must be a **manager**, and the person must belong to the caller's node or a
  descendant. When creating or moving someone, the target `nodeId` must also be inside the caller's scope. Employees get `403`.
- A username that is already taken returns `409`. Invalid request bodies return `400`.

`POST` / `PUT` body (`password` is required on `POST`; on `PUT` it is optional, and left unchanged when omitted;
at least 8 characters):

```json
{ "name": "Ana Anic", "username": "ana.anic", "password": "newpassword1", "role": "EMPLOYEE", "nodeId": "<node id>" }
```

"Employees" and "managers" are the people with the role `EMPLOYEE` and `MANAGER` respectively, and each has its own
listing endpoints. If employees should be limited to their own node only, `accessibleNodeIds` in
`src/services/accessService.js` is the one place to change.

## Configuration

Environment variables (all optional). They can also be put in a `.env` file, see `.env.example`.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `MONGODB_URI` | `mongodb://localhost:27017/Insightful_Test` | MongoDB connection string |
| `JWT_SECRET` | dev secret | At least 32 characters. Always set your own outside local development |
| `JWT_EXPIRATION_MINUTES` | `60` | Token lifetime |
| `SEED_ENABLED` | `true` | Run the seeder on startup |
| `SEED_RESET` | `false` | Wipe both collections and reseed on startup |

## Web frontend

The project also serves a deliberately small browser frontend from the same Express server, so there is no
separate frontend server to start and no CORS configuration is needed. Open `http://localhost:8080/` after
`npm start` (or after `docker compose up --build`).

The UI provides:

- login with the existing `/api/auth/login` endpoint;
- a complete organization tree, where only nodes returned by `/api/nodes/visible` are clickable;
- an employee list for the selected node;
- manager-only delete and move-to-node controls;
- a read-only employee view without management controls;
- a REST request/response log showing the latest eight API calls inside fixed-height scrollable panels;
- four quick-login buttons on the login page: root manager, root employee, middle-level manager (`Novi Sad`) and leaf employee (`Radnja 1`).

The frontend intentionally avoids Angular because the bonus only needs a small amount of UI. It is a single browser JavaScript
file at `src/public/app.js`, served directly by the same Express server. There is no separate frontend build step.
