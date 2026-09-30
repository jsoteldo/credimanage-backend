import { assertNonProductionDatabase } from './assert-non-production-db';

describe('Safety Guard: assertNonProductionDatabase', () => {
  const neonProductionUrl =
    'postgresql://neondb_owner:npg_VJeh3iMDLG6O@ep-purple-mouse-aceufutz.sa-east-1.aws.neon.tech/credimanage?sslmode=require';

  it('ABORTS immediately on Neon production URL', () => {
    expect(() => assertNonProductionDatabase(neonProductionUrl)).toThrow(
      /FATAL SAFETY VIOLATION/,
    );
  });

  it('ABORTS on any URL containing neon.tech', () => {
    expect(() =>
      assertNonProductionDatabase(
        'postgresql://user:pass@some-db.neon.tech/credimanage_e2e_test',
      ),
    ).toThrow(/production signature "neon.tech"/);
  });

  it('ABORTS on any URL with ep-purple-mouse-aceufutz signature', () => {
    expect(() =>
      assertNonProductionDatabase(
        'postgresql://user:pass@ep-purple-mouse-aceufutz.some.domain/credimanage_e2e_test',
      ),
    ).toThrow(/production signature "ep-purple-mouse-aceufutz"/);
  });

  it('ABORTS if host is remote even if database is named _test', () => {
    expect(() =>
      assertNonProductionDatabase(
        'postgresql://user:pass@192.168.1.50:5432/credimanage_e2e_test',
      ),
    ).toThrow(/not an authorized local test host/);
  });

  it('ABORTS if host is local but database is NOT credimanage_e2e_test (e.g. credimanage or postgres)', () => {
    expect(() =>
      assertNonProductionDatabase(
        'postgresql://postgres:1234@127.0.0.1:5432/credimanage?schema=public',
      ),
    ).toThrow(/does not match strict whitelist "credimanage_e2e_test"/);

    expect(() =>
      assertNonProductionDatabase(
        'postgresql://postgres:1234@localhost:5432/postgres',
      ),
    ).toThrow(/does not match strict whitelist "credimanage_e2e_test"/);
  });

  it('ALLOWS strictly localhost or 127.0.0.1 with database credimanage_e2e_test', () => {
    expect(
      assertNonProductionDatabase(
        'postgresql://postgres:secret@127.0.0.1:5432/credimanage_e2e_test?schema=public',
      ),
    ).toBe(true);

    expect(
      assertNonProductionDatabase(
        'postgresql://postgres:secret@localhost:5432/credimanage_e2e_test',
      ),
    ).toBe(true);
  });
});
