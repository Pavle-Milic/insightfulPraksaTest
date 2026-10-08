// JavaScript has no enums, so we use frozen objects: Role.MANAGER === 'MANAGER'.

export const Role = Object.freeze({
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
});

export const NodeType = Object.freeze({
  OFFICE: 'OFFICE',
  STORE: 'STORE',
});
