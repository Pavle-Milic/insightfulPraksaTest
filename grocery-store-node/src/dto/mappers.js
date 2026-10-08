// What the API returns. The password hash is never included.
// (In Java these were records with a static from() method.)

export function toEmployeeDto(employee) {
  return {
    id: employee.id,
    name: employee.name,
    username: employee.username,
    role: employee.role,
    nodeId: employee.nodeId,
  };
}

/** What the client may know about the logged-in user. */
export function toUserInfo(employee) {
  return toEmployeeDto(employee);
}

/** Basic node info, enough to draw the tree: the root has parentId = null. */
export function toNodeDto(node) {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    parentId: node.parentId,
  };
}
