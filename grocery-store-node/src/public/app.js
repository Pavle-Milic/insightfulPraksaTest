"use strict";
const LOG_LIMIT = 8;
const state = {
    token: sessionStorage.getItem('insightfulToken'),
    user: JSON.parse(sessionStorage.getItem('insightfulUser') || 'null'),
    nodes: [],
    accessibleNodeIds: new Set(),
    selectedNodeId: null,
    selectedNodeEmployees: [],
    restLogs: [],
};
const $ = (id) => document.getElementById(id);
const loginView = $('loginView');
const appView = $('appView');
const treeView = $('treeView');
const employeeView = $('employeeView');
const loginForm = $('loginForm');
const loginUsername = $('loginUsername');
const loginPassword = $('loginPassword');
const loginError = $('loginError');
const treeError = $('treeError');
const employeeError = $('employeeError');
const treeContainer = $('treeContainer');
const employeeTableBody = $('employeeTableBody');
const employeeTitle = $('employeeTitle');
const currentUser = $('currentUser');
const logoutButton = $('logoutButton');
const backToTreeButton = $('backToTreeButton');
const actionHeader = $('actionHeader');
const requestLog = $('requestLog');
const responseLog = $('responseLog');
function show(element, visible) {
    element.hidden = !visible;
}
function setError(element, message) {
    element.textContent = message;
    show(element, Boolean(message));
}
function saveSession(token, user) {
    state.token = token;
    state.user = user;
    sessionStorage.setItem('insightfulToken', token);
    sessionStorage.setItem('insightfulUser', JSON.stringify(user));
}
function clearSession() {
    state.token = null;
    state.user = null;
    state.nodes = [];
    state.accessibleNodeIds = new Set();
    state.selectedNodeId = null;
    state.selectedNodeEmployees = [];
    sessionStorage.removeItem('insightfulToken');
    sessionStorage.removeItem('insightfulUser');
}
function pretty(value) {
    if (value === undefined || value === null || value === '')
        return '';
    if (typeof value === 'string')
        return value;
    try {
        return JSON.stringify(value, null, 2);
    }
    catch {
        return String(value);
    }
}
function renderRestLog() {
    requestLog.textContent = state.restLogs
        .map((log, index) => {
        const body = log.requestBody !== undefined ? pretty(log.requestBody) : '-';
        return `#${index + 1} ${log.method} ${log.path}\nBody: ${body}`;
    })
        .join('\n\n------------------------------\n\n') || 'Nema poziva.';
    responseLog.textContent = state.restLogs
        .map((log, index) => {
        const body = pretty(log.responseBody) || '-';
        return `#${index + 1} ${log.status} ${log.statusText}\nBody: ${body}`;
    })
        .join('\n\n------------------------------\n\n') || 'Nema odgovora.';
}
function addRestLog(entry) {
    state.restLogs.unshift(entry);
    state.restLogs = state.restLogs.slice(0, LOG_LIMIT);
    renderRestLog();
}
async function apiRequest(method, path, body, useAuth = true) {
    const headers = {};
    if (body !== undefined)
        headers['Content-Type'] = 'application/json';
    if (useAuth && state.token)
        headers.Authorization = `Bearer ${state.token}`;
    let response;
    let responseBody = null;
    try {
        response = await fetch(path, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.status !== 204 && contentType.includes('application/json')) {
            responseBody = await response.json();
        }
        else if (response.status !== 204) {
            responseBody = await response.text();
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addRestLog({
            method,
            path,
            requestBody: body,
            status: 'NETWORK',
            statusText: 'Error',
            responseBody: message,
        });
        throw error;
    }
    addRestLog({
        method,
        path,
        requestBody: body,
        status: response.status,
        statusText: response.statusText,
        responseBody,
    });
    if (!response.ok) {
        const message = typeof responseBody === 'object' && responseBody !== null && 'message' in responseBody
            ? String(responseBody.message)
            : `HTTP ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        error.body = responseBody;
        throw error;
    }
    return responseBody;
}
async function login(username, password) {
    const result = await apiRequest('POST', '/api/auth/login', { username, password }, false);
    if (!result)
        throw new Error('Login nije vratio token.');
    saveSession(result.token, result.user);
    currentUser.textContent = `${result.user.name} (${result.user.role})`;
    show(loginView, false);
    show(appView, true);
    show(treeView, true);
    show(employeeView, false);
    await loadTree();
}
async function loadTree() {
    setError(treeError, '');
    try {
        const [nodes, visible] = await Promise.all([
            apiRequest('GET', '/api/nodes'),
            apiRequest('GET', '/api/nodes/visible'),
        ]);
        state.nodes = nodes || [];
        state.accessibleNodeIds = new Set(visible || []);
        renderTree();
    }
    catch (error) {
        const apiError = error;
        if (apiError.status === 401) {
            logout();
            setError(loginError, 'Sesija je istekla. Prijavite se ponovo.');
            return;
        }
        setError(treeError, error instanceof Error ? error.message : String(error));
    }
}
function buildChildrenByParent() {
    const children = new Map();
    for (const node of state.nodes) {
        const key = node.parentId || null;
        if (!children.has(key))
            children.set(key, []);
        children.get(key).push(node);
    }
    return children;
}
function renderTree() {
    treeContainer.innerHTML = '';
    const children = buildChildrenByParent();
    const roots = children.get(null) || [];
    const rootList = document.createElement('ul');
    for (const root of roots) {
        rootList.appendChild(renderTreeNode(root, children));
    }
    treeContainer.appendChild(rootList);
}
function renderTreeNode(node, children) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    const accessible = state.accessibleNodeIds.has(node.id);
    button.type = 'button';
    button.className = `node-button${accessible ? ' accessible' : ''}`;
    button.disabled = !accessible;
    button.textContent = node.name;
    const type = document.createElement('span');
    type.className = 'node-type';
    type.textContent = `(${node.type})`;
    button.appendChild(type);
    if (accessible)
        button.addEventListener('click', () => openEmployeeManager(node.id));
    li.appendChild(button);
    const childNodes = children.get(node.id) || [];
    if (childNodes.length > 0) {
        const ul = document.createElement('ul');
        for (const child of childNodes)
            ul.appendChild(renderTreeNode(child, children));
        li.appendChild(ul);
    }
    return li;
}
async function openEmployeeManager(nodeId) {
    setError(employeeError, '');
    state.selectedNodeId = nodeId;
    show(treeView, false);
    show(employeeView, true);
    const node = getNode(nodeId);
    employeeTitle.textContent = `Employees — ${node?.name || nodeId}`;
    try {
        state.selectedNodeEmployees =
            (await apiRequest('GET', `/api/nodes/${nodeId}/employees`)) || [];
        renderEmployees();
    }
    catch (error) {
        const apiError = error;
        if (apiError.status === 401) {
            logout();
            setError(loginError, 'Sesija je istekla. Prijavite se ponovo.');
            return;
        }
        setError(employeeError, error instanceof Error ? error.message : String(error));
    }
}
function getNode(nodeId) {
    return state.nodes.find((node) => node.id === nodeId) || null;
}
function accessibleNodesSorted() {
    return state.nodes
        .filter((node) => state.accessibleNodeIds.has(node.id))
        .sort((a, b) => a.name.localeCompare(b.name));
}
function createNodeSelect(selectedId, disabled = false) {
    const select = document.createElement('select');
    select.disabled = disabled;
    for (const node of accessibleNodesSorted()) {
        const option = document.createElement('option');
        option.value = node.id;
        option.textContent = node.name;
        option.selected = node.id === selectedId;
        select.appendChild(option);
    }
    return select;
}
function renderEmployees() {
    employeeTableBody.innerHTML = '';
    const managerMode = state.user?.role === 'MANAGER';
    actionHeader.textContent = managerMode ? 'Action' : '';
    for (const employee of state.selectedNodeEmployees) {
        const row = document.createElement('tr');
        const nameCell = document.createElement('td');
        const usernameCell = document.createElement('td');
        const nodeCell = document.createElement('td');
        const actionCell = document.createElement('td');
        actionCell.className = 'action-cell';
        nameCell.textContent = employee.name;
        usernameCell.textContent = employee.username;
        if (managerMode) {
            const select = createNodeSelect(employee.nodeId);
            select.addEventListener('change', async () => {
                const oldNodeId = employee.nodeId;
                try {
                    const updated = await apiRequest('PUT', `/api/employees/${employee.id}`, {
                        name: employee.name,
                        username: employee.username,
                        role: employee.role,
                        nodeId: select.value,
                    });
                    if (updated)
                        employee.nodeId = updated.nodeId;
                    await reloadSelectedNode();
                }
                catch (error) {
                    select.value = oldNodeId;
                    setError(employeeError, error instanceof Error ? error.message : String(error));
                }
            });
            nodeCell.appendChild(select);
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'delete-button';
            deleteButton.title = 'Delete employee';
            deleteButton.textContent = '✕';
            deleteButton.addEventListener('click', async () => {
                if (!window.confirm(`Obrisati ${employee.name}?`))
                    return;
                try {
                    await apiRequest('DELETE', `/api/employees/${employee.id}`);
                    await reloadSelectedNode();
                }
                catch (error) {
                    setError(employeeError, error instanceof Error ? error.message : String(error));
                }
            });
            actionCell.appendChild(deleteButton);
        }
        else {
            const node = getNode(employee.nodeId);
            nodeCell.textContent = node?.name || employee.nodeId;
        }
        row.append(nameCell, usernameCell, nodeCell, actionCell);
        employeeTableBody.appendChild(row);
    }
}
async function reloadSelectedNode() {
    if (!state.selectedNodeId)
        return;
    setError(employeeError, '');
    state.selectedNodeEmployees =
        (await apiRequest('GET', `/api/nodes/${state.selectedNodeId}/employees`)) || [];
    renderEmployees();
}
function backToTree() {
    state.selectedNodeId = null;
    show(employeeView, false);
    show(treeView, true);
    renderTree();
}
function logout() {
    clearSession();
    show(appView, false);
    show(loginView, true);
    loginForm.reset();
}
function setupLoginPresets() {
    const presetButtons = document.querySelectorAll('[data-login-user]');
    presetButtons.forEach((button) => {
        button.addEventListener('click', () => {
            loginUsername.value = button.dataset.loginUser || '';
            loginPassword.value = button.dataset.loginPassword || 'password123';
            loginUsername.focus();
        });
    });
}
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError(loginError, '');
    const username = loginUsername.value.trim();
    const password = loginPassword.value;
    try {
        await login(username, password);
    }
    catch (error) {
        setError(loginError, error instanceof Error ? error.message : String(error));
    }
});
logoutButton.addEventListener('click', logout);
backToTreeButton.addEventListener('click', backToTree);
async function restoreSession() {
    if (!state.token)
        return;
    currentUser.textContent = state.user
        ? `${state.user.name} (${state.user.role})`
        : 'Logged in';
    show(loginView, false);
    show(appView, true);
    show(treeView, true);
    show(employeeView, false);
    await loadTree();
}
setupLoginPresets();
renderRestLog();
void restoreSession();
