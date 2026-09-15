const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('posApi', {
  auth: {
    status: () => ipcRenderer.invoke('auth:status'),
    setupAdmin: (credentials) => ipcRenderer.invoke('auth:setup-admin', credentials),
    verifyPin: (pin) => ipcRenderer.invoke('auth:verify-pin', pin),
    updateAdminPin: (data) => ipcRenderer.invoke('auth:update-admin-pin', data),
    resetAdminPin: (data) => ipcRenderer.invoke('auth:reset-admin-pin', data),
    regenerateRecovery: () => ipcRenderer.invoke('auth:regenerate-recovery'),
    loginUser: (credentials) => ipcRenderer.invoke('auth:login-user', credentials),
    logoutUser: () => ipcRenderer.invoke('auth:logout-user')
  },
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    save: (user) => ipcRenderer.invoke('users:save', user),
    setActive: (user) => ipcRenderer.invoke('users:set-active', user)
  },
  business: {
    get: () => ipcRenderer.invoke('business:get'),
    save: (config) => ipcRenderer.invoke('business:save', config)
  },
  products: {
    list: (search) => ipcRenderer.invoke('products:list', search),
    save: (product) => ipcRenderer.invoke('products:save', product),
    pickImage: () => ipcRenderer.invoke('products:pick-image'),
    archive: (id, usuarioId) => ipcRenderer.invoke('products:archive', { id, usuarioId }),
    export: () => ipcRenderer.invoke('inventory:export'),
    movements: (productId) => ipcRenderer.invoke('inventory:movements', productId),
    adjust: (movement) => ipcRenderer.invoke('inventory:adjust', movement),
    receive: (movement) => ipcRenderer.invoke('inventory:receive', movement),
    exportCsv: () => ipcRenderer.invoke('inventory:export-csv')
  },
  sales: {
    create: (sale) => ipcRenderer.invoke('sales:create', sale),
    summary: () => ipcRenderer.invoke('sales:summary'),
    report: (range) => ipcRenderer.invoke('sales:report', range),
    receipt: (saleId) => ipcRenderer.invoke('sales:receipt', saleId),
    cancel: (data) => ipcRenderer.invoke('sales:cancel', data),
    exportCsv: (range) => ipcRenderer.invoke('sales:export-csv', range)
  },
  credit: {
    list: () => ipcRenderer.invoke('credit:list'),
    saveCustomer: (customer) => ipcRenderer.invoke('credit:save-customer', customer),
    payment: (payment) => ipcRenderer.invoke('credit:payment', payment)
  },
  audit: {
    list: (limit) => ipcRenderer.invoke('audit:list', limit)
  },
  cash: {
    current: () => ipcRenderer.invoke('cash:current'),
    open: (data) => ipcRenderer.invoke('cash:open', data),
    close: (data) => ipcRenderer.invoke('cash:close', data)
  },
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    export: () => ipcRenderer.invoke('backup:export'),
    restore: () => ipcRenderer.invoke('backup:restore')
  }
});
