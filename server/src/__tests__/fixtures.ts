export const validManifest = {
  contractVersion: '1',
  id: 'invoice',
  name: 'Invoice',
  version: '1.2.0',
  description: 'Create and send invoices',
  type: 'fullstack',
  category: 'Accounting',
  dependsOn: [{ id: 'payment-method', versionRange: '^1.0.0' }],
  provides: {
    apiPrefix: '/api/invoice',
    routes: [{ method: 'GET', path: '/invoices', permission: 'invoice.invoice.read' }],
    uiExports: [{ name: 'InvoiceList', kind: 'component' }],
  },
  requires: {
    env: [{ name: 'SMTP_URL', description: 'Mail server', secret: true }],
    database: { tables: ['invoice_invoices'], prefix: 'invoice_' },
    hostServices: ['auth.currentUser', 'db', 'notifications'],
  },
  events: { publishes: ['invoice.created'], consumes: ['payment_method.added'] },
  permissions: ['invoice.invoice.read', 'invoice.invoice.create'],
  runtime: { frontendCommand: 'npm run dev', backendCommand: 'npm start', ports: { frontend: 5173, backend: 5000 } },
  compatibility: { moduleforge: '>=1.0.0' },
};
