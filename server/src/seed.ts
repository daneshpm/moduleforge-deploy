import { prisma } from './prisma';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const CATEGORIES = [
  { name: 'CRM', slug: 'crm', description: 'Customer relationship and lead management' },
  { name: 'Accounting', slug: 'accounting', description: 'Invoices, expenses, and double-entry bookkeeping' },
  { name: 'Inventory', slug: 'inventory', description: 'Stock levels, SKU tracking, and warehouse management' },
  { name: 'Payments', slug: 'payments', description: 'Payment gateways, subscriptions, and transaction webhooks' },
  { name: 'Authentication', slug: 'authentication', description: 'User login, registration, JWT, and access control' },
  { name: 'Analytics', slug: 'analytics', description: 'Business metrics, tracking, and dashboard reporting' },
  { name: 'HR', slug: 'hr', description: 'Employee management, payroll, and onboarding' },
  { name: 'E-commerce', slug: 'ecommerce', description: 'Shopping cart, product catalog, and orders' },
  { name: 'Marketing', slug: 'marketing', description: 'Email campaigns, landing pages, and lead capture' },
  { name: 'Productivity', slug: 'productivity', description: 'Task management, document collaboration, and search' },
  { name: 'Communication', slug: 'communication', description: 'Notifications, SMS, chat, and email adapters' },
  { name: 'Other', slug: 'other', description: 'General utility and miscellaneous software modules' },
];

async function seed() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Categories
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
  }
  console.log('✓ Categories seeded successfully');

  // 2. Default Dev User
  const devUser = await prisma.user.upsert({
    where: { email: 'dev@moduleforge.io' },
    update: {},
    create: {
      email: 'dev@moduleforge.io',
      name: 'Developer Mode User',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      isDev: true,
    },
  });

  // 3. Seed Sample Modules
  const sampleModulesDir = path.join(__dirname, '..', '..', 'sample_modules');
  const sampleSlugs = ['crm', 'books', 'inventory', 'payments', 'auth'];

  for (const slug of sampleSlugs) {
    const modDir = path.join(sampleModulesDir, slug);
    const jsonPath = path.join(modDir, 'module.json');

    if (fs.existsSync(jsonPath)) {
      const rawJson = fs.readFileSync(jsonPath, 'utf-8');
      const parsed = JSON.parse(rawJson);

      // Create ZIP buffer from folder
      const zip = new JSZip();
      function addFolder(dir: string, rootRel: string) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const rel = rootRel ? path.join(rootRel, item) : item;
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory()) {
            addFolder(itemPath, rel);
          } else {
            zip.file(rel.replace(/\\/g, '/'), fs.readFileSync(itemPath));
          }
        }
      }
      addFolder(modDir, '');

      const uploadsDir = path.join(__dirname, '..', 'uploads');
      fs.mkdirSync(uploadsDir, { recursive: true });
      const zipFileName = `${parsed.slug}-v${parsed.version}.zip`;
      const zipFilePath = path.join(uploadsDir, zipFileName);
      
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      fs.writeFileSync(zipFilePath, zipBuffer);

      // Upsert Module
      const categoryName = parsed.category === 'CRM' ? 'CRM' :
        parsed.category === 'Accounting' ? 'Accounting' :
        parsed.category === 'Inventory' ? 'Inventory' :
        parsed.category === 'Payments' ? 'Payments' :
        parsed.category === 'Authentication' ? 'Authentication' : 'Other';

      const technologiesJson = JSON.stringify(parsed.technologies || ['React', 'Node.js']);
      const existingModule = await prisma.module.findUnique({ where: { slug: parsed.slug } });

      if (existingModule) {
        await prisma.module.update({
          where: { slug: parsed.slug },
          data: {
            name: parsed.name,
            description: parsed.description,
            author: parsed.author,
            categoryName,
            version: parsed.version,
            technologies: technologiesJson,
            sourceType: 'upload',
            zipStoragePath: zipFilePath,
            moduleJson: rawJson,
            downloads: existingModule.downloads || 42,
          },
        });
      } else {
        await prisma.module.create({
          data: {
            slug: parsed.slug,
            name: parsed.name,
            description: parsed.description,
            author: parsed.author,
            categoryName,
            version: parsed.version,
            technologies: technologiesJson,
            sourceType: 'upload',
            zipStoragePath: zipFilePath,
            moduleJson: rawJson,
            downloads: Math.floor(Math.random() * 200) + 50,
            isPublished: true,
            authorId: devUser.id,
            versions: {
              create: {
                version: parsed.version,
                moduleJson: rawJson,
                zipStoragePath: zipFilePath,
              },
            },
          },
        });
      }
      console.log(`✓ Seeded module: ${parsed.name} v${parsed.version}`);
    }
  }

  // 4. Seed Sample Projects for Dev User
  const crmMod = await prisma.module.findUnique({ where: { slug: 'crm' } });
  const booksMod = await prisma.module.findUnique({ where: { slug: 'books' } });
  const invMod = await prisma.module.findUnique({ where: { slug: 'inventory' } });

  if (crmMod && booksMod && invMod) {
    const existingProject = await prisma.project.findFirst({ where: { name: 'My ERP' } });
    if (!existingProject) {
      await prisma.project.create({
        data: {
          name: 'My ERP',
          description: 'Integrated enterprise business solution combining CRM, Books, and Inventory.',
          userId: devUser.id,
          canvasConfig: JSON.stringify({ zoom: 1, pan: { x: 0, y: 0 } }),
          modules: {
            create: [
              { moduleId: crmMod.id, moduleVersion: crmMod.version, xPosition: 100, yPosition: 100 },
              { moduleId: booksMod.id, moduleVersion: booksMod.version, xPosition: 400, yPosition: 100 },
              { moduleId: invMod.id, moduleVersion: invMod.version, xPosition: 250, yPosition: 300 },
            ],
          },
        },
      });
      console.log('✓ Seeded sample project: My ERP');
    }
  }

  console.log('🎉 Seeding complete!');
}

seed()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
