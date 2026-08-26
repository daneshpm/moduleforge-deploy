import { Router } from 'express';
import { prisma } from '../prisma';

export const categoriesRouter = Router();

categoriesRouter.get('/', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
