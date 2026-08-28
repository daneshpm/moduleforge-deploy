import { Router } from 'express';
import { prisma } from '../prisma';

export const categoriesRouter = Router();

categoriesRouter.get('/', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(categories || []);
  } catch (error: any) {
    console.error('Error fetching categories (using fallback list):', error.message);
    const fallbackCategories = [
      { id: 'cat-crm', name: 'CRM & ERP', slug: 'crm', description: 'Customer & enterprise modules' },
      { id: 'cat-auth', name: 'Auth & Identity', slug: 'auth', description: 'Authentication and user management' },
      { id: 'cat-db', name: 'Databases & Storage', slug: 'database', description: 'Postgres, MongoDB, Redis connectors' },
      { id: 'cat-pay', name: 'Payments & Billing', slug: 'payments', description: 'Stripe, PayPal, Razorpay integrations' },
    ];
    res.json(fallbackCategories);
  }
});
