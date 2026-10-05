import { ErpService } from './erp.service';
import { customerRefFor, parseCustomerRef, scopedCustomerRef } from './erp-refs';
import { AuthContext } from '../../../common/auth/decorators';

const A: AuthContext = { userId: 'svc', sessionId: 'integration', orgId: 'plantA', role: 'TADBIRKOR', integration: { id: 'key1', name: 'Insof ERP' } };

function make(prisma: Record<string, unknown>, allow = jest.fn().mockResolvedValue(true)) {
  const redis = { allow };
  const svc = new ErpService(prisma as never, {} as never, {} as never, {} as never, { emit: jest.fn() } as never, {} as never, redis as never);
  return { svc, redis };
}

describe('erp-refs', () => {
  it('zavod bo\'yicha nomlar fazosi: boshqa zavod kartasi oshkor qilinmaydi', () => {
    const stored = scopedCustomerRef('plantA', '123');
    expect(parseCustomerRef(stored)).toEqual({ plantOrgId: 'plantA', ref: '123' });
    expect(customerRefFor('plantA', stored)).toBe('123');
    expect(customerRefFor('plantB', stored)).toBeNull();
    expect(customerRefFor('plantB', '777')).toBe('777'); // eski prefikssiz yozuv
  });
});

describe('ErpService — tashkilot doirasi', () => {
  it('verifyCredentials: telefon/kalit limiti oshsa parol tekshirilmaydi', async () => {
    const prisma = { user: { findFirst: jest.fn() } };
    const allow = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const { svc } = make(prisma, allow);
    await expect(svc.verifyCredentials(A, '+998901234567', 'x')).rejects.toMatchObject({ code: 'RATE_LIMIT' });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(allow).toHaveBeenCalledWith('erp:verify:key:key1', expect.any(Number), expect.any(Number));
    expect(allow).toHaveBeenCalledWith('erp:verify:phone:+998901234567', expect.any(Number), expect.any(Number));
  });

  it('verifyCredentials: faqat shu zavodga aloqador foydalanuvchi qidiriladi', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(null) } };
    const { svc } = make(prisma);
    await expect(svc.verifyCredentials(A, '+998901234567', 'x')).rejects.toMatchObject({ code: 'AUTH_BAD_CREDENTIALS' });
    const where = JSON.stringify(prisma.user.findFirst.mock.calls[0][0].where);
    expect(where).toContain('"organizationId":"plantA"');
    expect(where).toContain('erp:plantA:');
  });

  it('appUsers: so\'rov shu zavod a\'zolari/mijozlari bilan cheklangan', async () => {
    const prisma = { user: { findMany: jest.fn().mockResolvedValue([]) } };
    const { svc } = make(prisma);
    await svc.appUsers(A, undefined, 'HAYDOVCHI');
    const arg = prisma.user.findMany.mock.calls[0][0];
    expect(JSON.stringify(arg.where)).toContain('"organizationId":"plantA"');
    expect(arg.select.memberships.where).toBeDefined();
  });

  it('upsertCustomer: boshqa zavodning bir xil id/INN/nomli mijozi topilmaydi — yangi prefiksli tashkilot ochiladi', async () => {
    const created = { id: 'newOrg', externalRef: scopedCustomerRef('plantA', '123'), inn: null, name: 'X', deletedAt: null };
    const prisma = {
      organization: {
        findUnique: jest.fn().mockImplementation(({ where }: { where: { externalRef?: string; inn?: string } }) =>
          // INN boshqa zavod mijozida band
          Promise.resolve(where.inn === '123456789' ? { id: 'foreign' } : null)),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
        update: jest.fn().mockResolvedValue(created),
      },
      creditLimit: { upsert: jest.fn() },
    };
    const { svc } = make(prisma);
    const res = await svc.upsertCustomer(A, { externalRef: '123', name: 'X', inn: '123456789' } as never);
    // externalRef bo'yicha: avval prefiksli kalit, keyin eski kalit — faqat shu zavod doirasida
    expect(prisma.organization.findUnique).toHaveBeenCalledWith({ where: { externalRef: 'erp:plantA:123' } });
    for (const [arg] of prisma.organization.findFirst.mock.calls) {
      expect(JSON.stringify(arg.where)).toContain('plantA');
    }
    expect(prisma.organization.create).toHaveBeenCalledWith({ data: expect.objectContaining({ externalRef: 'erp:plantA:123', inn: null }) });
    expect(res.externalRef).toBe('123');
  });

  it('linkCustomer: boshqa ERP kartasiga ulangan ilova hisobi o\'zgartirilmaydi', async () => {
    const prisma = {
      organization: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ id: 't1', type: 'CONTRACTOR', externalRef: 'erp:plantB:9' }) // target
          .mockResolvedValueOnce(null), // legacy lookup
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const { svc } = make(prisma);
    await expect(svc.linkCustomer(A, '9', 't1')).rejects.toMatchObject({ code: 'CUSTOMER_ALREADY_LINKED' });
    expect(prisma.organization.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('linkCustomer: ulanmagan ilova hisobiga shu zavodning prefiksli kaliti yoziladi', async () => {
    const prisma = {
      organization: {
        findFirst: jest.fn().mockResolvedValueOnce({ id: 't1', type: 'CONTRACTOR', externalRef: null }).mockResolvedValueOnce(null),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const { svc } = make(prisma);
    await svc.linkCustomer(A, '9', 't1');
    expect(prisma.organization.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { externalRef: 'erp:plantA:9' } });
  });
});
