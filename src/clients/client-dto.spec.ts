import { Prisma } from '@prisma/client';
import { toClientDto, ClientResponseDto } from './client.dto';
import { InternalServerErrorException } from '@nestjs/common';

describe('FASE 2B.1.1 — Pruebas de Contrato HTTP Client DTO', () => {
  const baseClient = {
    id: 'cli-test-1',
    clientNumber: 'CLI-2000',
    name: 'Cliente Prueba',
    phone: '999888777',
    address: 'Av. Principal 123',
    creditLimit: 1000,
    currentBalance: 0,
    dailyDebtBalance: new Prisma.Decimal(0),
    bankDebtBalance: new Prisma.Decimal(0),
    paymentPeriod: 'DiaFijo',
    paymentDay: '15',
    nextDueDate: '2026-10-15',
    status: 'Activo',
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-01T10:00:00.000Z'),
  };

  // ==========================================
  // Test A: Coexistencia con saldos positivos
  // ==========================================
  it('Test A: daily = 300, bank = 700, current = 1000 -> exposure = 1000 y saldos exactos', () => {
    const raw = {
      ...baseClient,
      dailyDebtBalance: new Prisma.Decimal(300),
      bankDebtBalance: new Prisma.Decimal(700),
      currentBalance: 1000,
      creditLimit: 2000,
    };

    const dto = toClientDto(raw)!;

    expect(dto.dailyDebtBalance).toBe(300);
    expect(dto.bankDebtBalance).toBe(700);
    expect(dto.currentBalance).toBe(1000);
    expect(dto.creditExposure).toBe(1000);
    expect(dto.availableCredit).toBe(1000); // 2000 - 1000
    expect(typeof dto.dailyDebtBalance).toBe('number');
    expect(typeof dto.bankDebtBalance).toBe('number');
    expect(typeof dto.currentBalance).toBe('number');
    expect(typeof dto.creditExposure).toBe('number');
  });

  // ==========================================
  // Test B: Saldo a favor diario con deuda bancaria
  // ==========================================
  it('Test B: daily = -200, bank = 600, limit = 1000 -> current = 400, exposure = 600, available = 400', () => {
    const raw = {
      ...baseClient,
      dailyDebtBalance: new Prisma.Decimal(-200),
      bankDebtBalance: new Prisma.Decimal(600),
      currentBalance: 400,
      creditLimit: 1000,
    };

    const dto = toClientDto(raw)!;

    expect(dto.currentBalance).toBe(400);
    expect(dto.creditExposure).toBe(600); // max(0, -200) + 600 = 600
    expect(dto.availableCredit).toBe(400); // max(0, 1000 - 600) = 400
  });

  // ==========================================
  // Test C: Saldo a favor NO aumenta crédito disponible
  // ==========================================
  it('Test C: daily = -200, bank = 0, limit = 1000 -> availableCredit = 1000 (NO 1200)', () => {
    const raw = {
      ...baseClient,
      dailyDebtBalance: new Prisma.Decimal(-200),
      bankDebtBalance: new Prisma.Decimal(0),
      currentBalance: -200,
      creditLimit: 1000,
    };

    const dto = toClientDto(raw)!;

    expect(dto.creditExposure).toBe(0); // max(0, -200) + 0 = 0
    expect(dto.availableCredit).toBe(1000); // NO 1200!
    expect(dto.availableCredit).not.toBe(1200);
  });

  // ==========================================
  // Test D: availableCredit es null cuando creditLimit <= 0
  // ==========================================
  it('Test D: creditLimit <= 0 -> availableCredit = null (representación técnica sin textos localizados)', () => {
    const rawZeroLimit = {
      ...baseClient,
      creditLimit: 0,
      dailyDebtBalance: new Prisma.Decimal(100),
      bankDebtBalance: new Prisma.Decimal(0),
      currentBalance: 100,
    };

    const dtoZero = toClientDto(rawZeroLimit)!;
    expect(dtoZero.availableCredit).toBeNull();
    expect(dtoZero.availableCredit).not.toBe('Sin límite');

    const rawNegativeLimit = {
      ...baseClient,
      creditLimit: -500,
      dailyDebtBalance: new Prisma.Decimal(50),
      bankDebtBalance: new Prisma.Decimal(0),
      currentBalance: 50,
    };

    const dtoNegative = toClientDto(rawNegativeLimit)!;
    expect(dtoNegative.availableCredit).toBeNull();
  });

  // ==========================================
  // Test E: Decimal 6.00 -> JSON number 6
  // ==========================================
  it('Test E: Prisma.Decimal("6.00") se convierte a JSON number 6', () => {
    const raw = {
      ...baseClient,
      dailyDebtBalance: new Prisma.Decimal('6.00'),
      bankDebtBalance: new Prisma.Decimal('0.00'),
      currentBalance: new Prisma.Decimal('6.00'),
      creditLimit: new Prisma.Decimal('0.00'),
    };

    const dto = toClientDto(raw)!;

    expect(dto.dailyDebtBalance).toBe(6);
    expect(typeof dto.dailyDebtBalance).toBe('number');
    expect(dto.bankDebtBalance).toBe(0);
    expect(typeof dto.bankDebtBalance).toBe('number');
    expect(dto.currentBalance).toBe(6);

    const serialized = JSON.stringify(dto);
    const parsed = JSON.parse(serialized);
    expect(parsed.dailyDebtBalance).toBe(6);
    expect(parsed.bankDebtBalance).toBe(0);
    expect(parsed.currentBalance).toBe(6);
  });

  // ==========================================
  // Test F: Ausencia total de campos internos en el DTO
  // ==========================================
  it('Test F: Los campos internos de infraestructura NO aparecen en el DTO público', () => {
    const raw = {
      ...baseClient,
      balanceModelVersion: 'BALANCE_MODEL_V1',
      balanceOrigin: 'MIGRATED_BASELINE',
      isBaselineMovement: true,
      reconciliationRef: 'REC-999',
      legacyUnknownPaymentCount: 3,
      openingSnapshots: [
        { status: 'ACTIVO', migrationVersion: 'BALANCE_MODEL_V1' },
      ],
      adjustments: [{ id: 'adj-1', amount: 50 }],
    };

    const dto = toClientDto(raw)!;

    expect(dto).not.toHaveProperty('balanceModelVersion');
    expect(dto).not.toHaveProperty('balanceOrigin');
    expect(dto).not.toHaveProperty('isBaselineMovement');
    expect(dto).not.toHaveProperty('reconciliationRef');
    expect(dto).not.toHaveProperty('legacyUnknownPaymentCount');
    expect(dto).not.toHaveProperty('openingSnapshots');
    expect(dto).not.toHaveProperty('adjustments');

    const allowedKeys = [
      'id',
      'clientNumber',
      'name',
      'phone',
      'address',
      'creditLimit',
      'currentBalance',
      'dailyDebtBalance',
      'bankDebtBalance',
      'creditExposure',
      'availableCredit',
      'paymentPeriod',
      'paymentDay',
      'nextDueDate',
      'status',
      'createdAt',
      'updatedAt',
    ];

    expect(Object.keys(dto).sort()).toEqual(allowedKeys.sort());
  });

  // ==========================================
  // Test G: Consistencia de mapeo y preservación de campos públicos
  // ==========================================
  it('Test G: Preserva con exactitud todos los campos públicos existentes', () => {
    const raw = {
      ...baseClient,
      paymentPeriod: 'DiaFijo',
    };

    const dto = toClientDto(raw)!;

    expect(dto.id).toBe('cli-test-1');
    expect(dto.clientNumber).toBe('CLI-2000');
    expect(dto.name).toBe('Cliente Prueba');
    expect(dto.phone).toBe('999888777');
    expect(dto.address).toBe('Av. Principal 123');
    expect(dto.paymentPeriod).toBe('Día Fijo'); // Mapeado correctamente de DiaFijo
    expect(dto.paymentDay).toBe('15');
    expect(dto.nextDueDate).toBe('2026-10-15');
    expect(dto.status).toBe('Activo');
  });

  // ==========================================
  // Test H: Cliente MIGRATED_BASELINE con snapshot -> DTO válido
  // ==========================================
  it('Test H: Cliente MIGRATED_BASELINE con snapshot ACTIVO BALANCE_MODEL_V1 -> DTO válido', () => {
    const migratedWithSnapshot = {
      ...baseClient,
      balanceOrigin: 'MIGRATED_BASELINE',
      balanceModelVersion: 'BALANCE_MODEL_V1',
      dailyDebtBalance: new Prisma.Decimal(6),
      bankDebtBalance: new Prisma.Decimal(0),
      currentBalance: 6,
      openingSnapshots: [
        { status: 'ACTIVO', migrationVersion: 'BALANCE_MODEL_V1' },
      ],
    };

    const dto = toClientDto(migratedWithSnapshot);
    expect(dto).not.toBeNull();
    expect(dto?.dailyDebtBalance).toBe(6);
    expect(dto?.bankDebtBalance).toBe(0);
  });

  // ==========================================
  // Test I: Cliente MIGRATED_BASELINE sin snapshot -> BALANCE_LEDGER_INTEGRITY_ERROR
  // ==========================================
  it('Test I: Cliente MIGRATED_BASELINE sin snapshot -> lanza BALANCE_LEDGER_INTEGRITY_ERROR', () => {
    const migratedWithoutSnapshot = {
      ...baseClient,
      balanceOrigin: 'MIGRATED_BASELINE',
      balanceModelVersion: 'BALANCE_MODEL_V1',
      dailyDebtBalance: new Prisma.Decimal(6),
      bankDebtBalance: new Prisma.Decimal(0),
      currentBalance: 6,
      openingSnapshots: [], // Sin snapshot
    };

    expect(() => toClientDto(migratedWithoutSnapshot)).toThrow(
      InternalServerErrorException,
    );
    expect(() => toClientDto(migratedWithoutSnapshot)).toThrow(
      /BALANCE_LEDGER_INTEGRITY_ERROR/,
    );
  });

  // ==========================================
  // Test J: Cliente NATIVE_V1 sin snapshot -> DTO válido
  // ==========================================
  it('Test J: Cliente NATIVE_V1 sin snapshot -> DTO válido', () => {
    const nativeClient = {
      ...baseClient,
      balanceOrigin: 'NATIVE_V1',
      balanceModelVersion: 'BALANCE_MODEL_V1',
      dailyDebtBalance: new Prisma.Decimal(150),
      bankDebtBalance: new Prisma.Decimal(50),
      currentBalance: 200,
      openingSnapshots: [], // Nativos no requieren snapshot
    };

    const dto = toClientDto(nativeClient);
    expect(dto).not.toBeNull();
    expect(dto?.dailyDebtBalance).toBe(150);
    expect(dto?.bankDebtBalance).toBe(50);
    expect(dto?.currentBalance).toBe(200);
    expect(dto?.creditExposure).toBe(200);
  });

  // ==========================================
  // Test K: Cliente NATIVE_V1 con saldos 0 -> daily 0, bank 0, current 0
  // ==========================================
  it('Test K: Cliente NATIVE_V1 con saldos iniciales 0 -> daily 0, bank 0, current 0', () => {
    const freshNativeClient = {
      ...baseClient,
      balanceOrigin: 'NATIVE_V1',
      balanceModelVersion: 'BALANCE_MODEL_V1',
      dailyDebtBalance: new Prisma.Decimal(0),
      bankDebtBalance: new Prisma.Decimal(0),
      currentBalance: 0,
      creditLimit: 500,
    };

    const dto = toClientDto(freshNativeClient)!;
    expect(dto.dailyDebtBalance).toBe(0);
    expect(dto.bankDebtBalance).toBe(0);
    expect(dto.currentBalance).toBe(0);
    expect(dto.creditExposure).toBe(0);
    expect(dto.availableCredit).toBe(500);
  });

  // ==========================================
  // Test L: balanceOrigin no aparece en DTO público
  // ==========================================
  it('Test L: balanceOrigin no aparece en DTO público bajo ningún origen', () => {
    const clientMigrated = {
      ...baseClient,
      balanceOrigin: 'MIGRATED_BASELINE',
      openingSnapshots: [
        { status: 'ACTIVO', migrationVersion: 'BALANCE_MODEL_V1' },
      ],
    };
    const dtoMigrated = toClientDto(clientMigrated)!;
    expect(dtoMigrated).not.toHaveProperty('balanceOrigin');

    const clientNative = {
      ...baseClient,
      balanceOrigin: 'NATIVE_V1',
    };
    const dtoNative = toClientDto(clientNative)!;
    expect(dtoNative).not.toHaveProperty('balanceOrigin');
  });

  // ==========================================
  // Test de Integridad: saldos nulos en clientes migrados
  // ==========================================
  it('Test Integridad: cliente migrado con dailyDebtBalance o bankDebtBalance null lanza excepción', () => {
    const nullDaily = {
      ...baseClient,
      balanceOrigin: 'MIGRATED_BASELINE',
      dailyDebtBalance: null,
      bankDebtBalance: new Prisma.Decimal(0),
      openingSnapshots: [
        { status: 'ACTIVO', migrationVersion: 'BALANCE_MODEL_V1' },
      ],
    };

    expect(() => toClientDto(nullDaily)).toThrow(
      /BALANCE_LEDGER_INTEGRITY_ERROR/,
    );

    const nullBank = {
      ...baseClient,
      balanceOrigin: 'NATIVE_V1',
      dailyDebtBalance: new Prisma.Decimal(0),
      bankDebtBalance: null,
    };

    expect(() => toClientDto(nullBank)).toThrow(
      /BALANCE_LEDGER_INTEGRITY_ERROR/,
    );
  });
});
