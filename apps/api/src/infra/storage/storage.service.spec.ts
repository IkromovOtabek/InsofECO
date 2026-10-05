import { MAX_UPLOAD_BYTES, parseUploadKey, presignUrl, StorageService } from './storage.service';

describe('presignUrl (SigV4)', () => {
  it('AWS hujjatidagi namunaviy imzo bilan mos keladi', () => {
    const url = presignUrl({
      method: 'GET',
      origin: 'https://examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      accessKey: 'AKIAIOSFODNN7EXAMPLE',
      secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      region: 'us-east-1',
      expiresSeconds: 86400,
      now: new Date('2013-05-24T00:00:00Z'),
    });
    expect(url).toContain('X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404');
  });
});

describe('StorageService', () => {
  const env = { ...process.env };
  const fetchMock = jest.fn();
  beforeEach(() => {
    process.env.S3_ENDPOINT = 'http://minio.local:9000';
    process.env.S3_BUCKET = 'insof';
    process.env.S3_ACCESS_KEY = 'ak';
    process.env.S3_SECRET_KEY = 'sk';
    fetchMock.mockReset();
    (globalThis as { fetch: unknown }).fetch = fetchMock;
  });
  afterAll(() => { process.env = env; });

  const head = (status: number, size: number, type: string) => ({ ok: status >= 200 && status < 300, status, headers: new Headers({ 'content-length': String(size), 'content-type': type }) });

  it('presign: javob shakli o\'zgarmagan, kalit foydalanuvchi prefiksida, URL haqiqiy SigV4 va qisqa muddatli', () => {
    const r = new StorageService().presignPut('user1', 'signature', 'image/png');
    expect(Object.keys(r).sort()).toEqual(['headers', 'key', 'method', 'url']);
    expect(r.method).toBe('PUT');
    expect(r.headers).toEqual({ 'content-type': 'image/png' });
    expect(r.key).toMatch(/^u\/user1\/signature\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.png$/);
    expect(r.url.startsWith(`http://minio.local:9000/insof/${r.key}?`)).toBe(true);
    expect(r.url).toContain('X-Amz-Expires=300');
    expect(r.url).toContain('X-Amz-SignedHeaders=content-type%3Bhost');
    expect(r.url).toMatch(/X-Amz-Signature=[0-9a-f]{64}$/);
  });

  it('presign: S3 kalitlari sozlanmagan bo\'lsa ishlamaydi (anonim bucket\'ga tushib qolmaydi)', () => {
    delete process.env.S3_SECRET_KEY;
    expect(() => new StorageService().presignPut('u', 'signature', 'image/png')).toThrow();
  });

  it('boshqa foydalanuvchining yoki boshqa maqsaddagi kaliti rad etiladi', async () => {
    const svc = new StorageService();
    const { key } = svc.presignPut('owner', 'signature', 'image/png');
    await expect(svc.verifyKey('attacker', key, ['signature'])).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(svc.verifyKey('owner', key, ['waybill'])).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(svc.verifyKey('owner', '../u/owner/x.png', ['signature'])).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('obyekt omborda yo\'q bo\'lsa rad etiladi', async () => {
    const svc = new StorageService();
    const { key } = svc.presignPut('owner', 'signature', 'image/png');
    fetchMock.mockResolvedValueOnce(head(404, 0, ''));
    await expect(svc.verifyKey('owner', key, ['signature'])).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'HEAD' });
  });

  it('hajmi chegaradan katta fayl o\'chiriladi va rad etiladi', async () => {
    const svc = new StorageService();
    const { key } = svc.presignPut('owner', 'signature', 'image/png');
    fetchMock.mockResolvedValueOnce(head(200, MAX_UPLOAD_BYTES.signature + 1, 'image/png')).mockResolvedValueOnce({ ok: true, status: 204 });
    await expect(svc.verifyKey('owner', key, ['signature'])).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'DELETE' });
  });

  it('to\'g\'ri fayl qabul qilinadi; eski joy egallovchi kalit yozilmaydi', async () => {
    const svc = new StorageService();
    const { key } = svc.presignPut('owner', 'waybill', 'image/jpeg');
    fetchMock.mockResolvedValueOnce(head(200, 1234, 'image/jpeg'));
    await expect(svc.verifyKey('owner', key, ['waybill'])).resolves.toBe(key);
    await expect(svc.verifyKey('owner', 'photo/demo.jpg', ['waybill'])).resolves.toBeUndefined();
    await expect(svc.verifyKeys('owner', ['old-key'], ['report'], ['old-key'])).resolves.toEqual(['old-key']);
  });

  it('eski formatdagi kalit (purpose/sana/userId/uuid) ham egasi bo\'yicha tekshiriladi', () => {
    expect(parseUploadKey('signature/2026-10-05/user1/123e4567-e89b-12d3-a456-426614174000.png')).toEqual({ userId: 'user1', purpose: 'signature', ext: 'png' });
    expect(parseUploadKey('photo/demo.jpg')).toBeNull();
  });
});
