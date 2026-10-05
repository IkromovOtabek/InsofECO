import { Prisma } from '@prisma/client';

/**
 * ERP mijoz kartasi id (Organization.externalRef) zavod bo'yicha nomlar fazosiga ajratiladi.
 *
 * `Organization.externalRef` butun bazada unique, ERP id'lari esa har zavodning o'z ERP'ida (1, 2, 3 ...) —
 * ikki zavodning "123" mijozi bitta tashkilotga tushib, biri ikkinchisining mijozini o'zgartirardi.
 * Endi yangi yozuvlar `erp:<plantOrgId>:<ref>` ko'rinishida saqlanadi; ERP'ga har doim toza `<ref>` qaytadi.
 * Eski (prefikssiz) yozuvlar faqat shu zavod bilan bog'langan bo'lsa (buyurtma/kredit limiti) yoki
 * boshqa hech bir zavodga bog'lanmagan bo'lsa tan olinadi.
 */
export const ERP_REF_PREFIX = 'erp:';

export function scopedCustomerRef(plantOrgId: string, ref: string): string {
  return `${ERP_REF_PREFIX}${plantOrgId}:${ref}`;
}

/** Saqlangan qiymatdan: qaysi zavodniki (prefiksli bo'lsa) va ERP ko'radigan id. */
export function parseCustomerRef(stored: string): { plantOrgId: string | null; ref: string } {
  if (!stored.startsWith(ERP_REF_PREFIX)) return { plantOrgId: null, ref: stored };
  const rest = stored.slice(ERP_REF_PREFIX.length);
  const i = rest.indexOf(':');
  if (i <= 0) return { plantOrgId: null, ref: stored };
  return { plantOrgId: rest.slice(0, i), ref: rest.slice(i + 1) };
}

/** ERP'ga qaytariladigan id: o'z zavodiniki — toza ref; boshqa zavodniki — null (oshkor qilinmaydi). */
export function customerRefFor(plantOrgId: string, stored: string | null): string | null {
  if (!stored) return null;
  const p = parseCustomerRef(stored);
  if (p.plantOrgId && p.plantOrgId !== plantOrgId) return null;
  return p.ref;
}

/** "Shu zavodning mijozi": shu zavod ERP kartasi, yoki shu zavodga buyurtmasi / kredit limiti bor. */
export function plantClientWhere(plantOrgId: string): Prisma.OrganizationWhereInput {
  return {
    type: 'CONTRACTOR',
    OR: [
      { externalRef: { startsWith: `${ERP_REF_PREFIX}${plantOrgId}:` } },
      { ordersAsClient: { some: { plantOrgId } } },
      { creditLimits: { some: { plantOrgId } } },
    ],
  };
}

/** Boshqa zavodga (buyurtma yoki kredit limiti orqali) bog'lanmagan tashkilot. */
export function notOtherPlantsWhere(plantOrgId: string): Prisma.OrganizationWhereInput {
  return {
    ordersAsClient: { none: { plantOrgId: { not: plantOrgId } } },
    creditLimits: { none: { plantOrgId: { not: plantOrgId } } },
  };
}
