import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function pad(s, n) {
  return (s || '').padEnd(n);
}

async function generateReport() {
  const lines = [];

  // 1. Users
  const users = await prisma.user.findMany({
    orderBy: { code: 'asc' },
    include: { role: true },
  });

  lines.push('====================================================================================================');
  lines.push('1. ПОЛЬЗОВАТЕЛИ (security.User) — все авторизованные аккаунты платформы');
  lines.push('   Всего: ' + users.length);
  lines.push('====================================================================================================');
  lines.push('CODE          |USERNAME              |EMAIL                           |FULL NAME                 |ROLE           |STATUS    |CUSTOMER                                |PARTNER                                 |CREATED AT');
  lines.push('----------------------------------------------------------------------------------------------------');

  for (const u of users) {
    const roleName = (u.role && u.role.code) || u.roleId || '';
    lines.push(
      pad(u.code, 12) + '|' +
      pad(u.username, 21) + '|' +
      pad(u.email, 31) + '|' +
      pad(u.fullName, 25) + '|' +
      pad(roleName, 15) + '|' +
      pad(u.status, 9) + '|' +
      pad(u.customerId, 38) + '|' +
      pad(u.partnerId, 38) + '|' +
      (u.createdAt ? u.createdAt.toISOString() : '')
    );
  }

  lines.push('');

  // 2. Customers
  const customers = await prisma.customer.findMany({
    orderBy: { code: 'asc' },
  });

  lines.push('====================================================================================================');
  lines.push('2. КЛИЕНТЫ (crm.Customer) — покупатели / лица CRM');
  lines.push('   Всего: ' + customers.length);
  lines.push('====================================================================================================');
  lines.push('CODE          |TYPE      |FIRST NAME          |LAST NAME           |COMPANY                   |EMAIL                             |PHONE             |STATUS    |CREATED AT');
  lines.push('----------------------------------------------------------------------------------------------------');

  for (const c of customers) {
    lines.push(
      pad(c.code, 12) + '|' +
      pad(c.type, 10) + '|' +
      pad(c.firstName, 19) + '|' +
      pad(c.lastName, 18) + '|' +
      pad(c.companyName, 25) + '|' +
      pad(c.email, 31) + '|' +
      pad(c.phone, 18) + '|' +
      pad(c.status, 9) + '|' +
      (c.createdAt ? c.createdAt.toISOString() : '')
    );
  }

  lines.push('');

  // 3. Partners
  const partners = await prisma.partner.findMany({
    orderBy: { code: 'asc' },
  });

  lines.push('====================================================================================================');
  lines.push('3. ПАРТНЁРЫ (crm.Partner) — продавцы платформы');
  lines.push('   Всего: ' + partners.length);
  lines.push('====================================================================================================');
  lines.push('CODE          |NAME                          |STATUS    |EMAIL                           |REG.NUMBER        |TAX ID        |COUNTRY   |COMPANY                   ');
  lines.push('----------------------------------------------------------------------------------------------------');

  for (const p of partners) {
    lines.push(
      pad(p.code, 12) + '|' +
      pad(p.name, 30) + '|' +
      pad(p.status, 9) + '|' +
      pad(p.contactEmail, 31) + '|' +
      pad(p.registrationNumber, 17) + '|' +
      pad(p.taxId, 12) + '|' +
      pad(p.countryCode, 9) + '|' +
      pad(p.companyId, 25)
    );
  }

  lines.push('');

  // 4. Companies
  const companies = await prisma.company.findMany({
    orderBy: { code: 'asc' },
  });

  lines.push('====================================================================================================');
  lines.push('4. КОМПАНИИ (crm.Company)');
  lines.push('   Всего: ' + companies.length);
  lines.push('====================================================================================================');
  lines.push('CODE          |NAME                                    |INN             |STATUS    ');
  lines.push('----------------------------------------------------------------------------------------------------');

  for (const c of companies) {
    lines.push(
      pad(c.code, 12) + '|' +
      pad(c.name, 38) + '|' +
      pad(c.inn, 15) + '|' +
      pad(c.status, 9)
    );
  }

  lines.push('');

  // 5. User -> Customer/Partner links
  lines.push('====================================================================================================');
  lines.push('5. СВЯЗКИ: User → Customer / Partner (object scope, RBAC §3)');
  lines.push('====================================================================================================');

  for (const u of users) {
    const uname = pad(u.username, 22);
    if (u.customerId) {
      lines.push(u.code + '   ' + uname + ' → CUSTOMER: ' + u.customerId);
    } else if (u.partnerId) {
      lines.push(u.code + '   ' + uname + ' → PARTNER: ' + u.partnerId);
    } else {
      lines.push(u.code + '   ' + uname + ' → — (staff/system)');
    }
  }

  const report = lines.join('\n');
  console.log(report);

  // Also write to file
  const fs = await import('fs');
  fs.writeFileSync('clients-report.txt', report, 'utf-8');
  console.log('\n\nReport saved to clients-report.txt');
}

generateReport()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
