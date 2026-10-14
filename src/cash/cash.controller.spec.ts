import { Test, TestingModule } from '@nestjs/testing';
import { CashController, StoreCashRegistersController, CashRegistersDirectController } from './cash.controller';
import { CashService } from './cash.service';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { CashRegisterStatus } from '@prisma/client';

describe('CashController & Permissions Tests', () => {
  let cashController: CashController;
  let storeRegistersController: StoreCashRegistersController;
  let cashRegistersDirectController: CashRegistersDirectController;
  let cashService: any;
  let permissionsGuard: PermissionsGuard;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const mockAdminUser = {
    id: 'u-admin',
    name: 'Admin User',
    role: 'Administrador',
    permissions: ['cash.manage', 'location.manage'],
  };

  const mockCajeroUser = {
    id: 'u-cajero',
    name: 'Cajero User',
    role: 'Cajero',
    permissions: ['sales.create', 'sales.view'],
  };

  beforeEach(async () => {
    cashService = {
      createCashRegister: jest.fn(async (dto: any, user: any) => ({
        id: 'reg-new',
        ...dto,
      })),
      getCashRegisters: jest.fn(async (storeId?: string) => [
        { id: 'reg-01', storeId: storeId || 'store-1', code: 'CAJA-01', name: 'Caja 1', status: CashRegisterStatus.ACTIVE },
      ]),
      updateCashRegister: jest.fn(async (id: string, dto: any, user: any) => ({
        id,
        ...dto,
      })),
    };

    reflector = new Reflector();
    permissionsGuard = new PermissionsGuard(reflector);
    rolesGuard = new RolesGuard(reflector);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CashController, StoreCashRegistersController, CashRegistersDirectController],
      providers: [
        { provide: CashService, useValue: cashService },
        { provide: Reflector, useValue: reflector },
        PermissionsGuard,
        RolesGuard,
      ],
    }).compile();

    cashController = module.get<CashController>(CashController);
    storeRegistersController = module.get<StoreCashRegistersController>(StoreCashRegistersController);
    cashRegistersDirectController = module.get<CashRegistersDirectController>(CashRegistersDirectController);
  });

  const createMockExecutionContext = (user: any, handler: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => handler,
      getClass: () => CashController,
    } as any;
  };

  describe('D. Permisos de Cajero vs Administrador', () => {
    it('Administrador tiene acceso a crear caja mediante RolesGuard y PermissionsGuard', () => {
      const context = createMockExecutionContext(mockAdminUser, cashController.createRegister);
      expect(rolesGuard.canActivate(context)).toBe(true);
      expect(permissionsGuard.canActivate(context)).toBe(true);
    });

    it('D. Cajero no puede crear caja: RolesGuard deniega acceso (false)', () => {
      const context = createMockExecutionContext(mockCajeroUser, cashController.createRegister);
      expect(rolesGuard.canActivate(context)).toBe(false);
    });

    it('D. Cajero no puede crear caja: PermissionsGuard lanza ForbiddenException por falta de cash.manage', () => {
      const context = createMockExecutionContext(mockCajeroUser, cashController.createRegister);
      expect(() => permissionsGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('Cajero sí puede consultar cajas para apertura de turno', async () => {
      const registers = await cashController.getRegisters('store-1');
      expect(registers).toHaveLength(1);
      expect(cashService.getCashRegisters).toHaveBeenCalledWith('store-1');
    });
  });

  describe('Endpoints equivalentes y Store-scoped', () => {
    it('StoreCashRegistersController delega creación con storeId inyectado', async () => {
      await storeRegistersController.createRegister(
        'store-2',
        { storeId: '', code: 'CAJA-02', name: 'Caja 2' } as any,
        { user: mockAdminUser },
      );
      expect(cashService.createCashRegister).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: 'store-2', code: 'CAJA-02' }),
        mockAdminUser,
      );
    });

    it('CashRegistersDirectController delega update y status patch', async () => {
      await cashRegistersDirectController.updateRegister(
        'reg-01',
        { name: 'Caja Editada' },
        { user: mockAdminUser },
      );
      expect(cashService.updateCashRegister).toHaveBeenCalledWith(
        'reg-01',
        { name: 'Caja Editada' },
        mockAdminUser,
      );

      await cashRegistersDirectController.updateRegisterStatus(
        'reg-01',
        CashRegisterStatus.INACTIVE,
        { user: mockAdminUser },
      );
      expect(cashService.updateCashRegister).toHaveBeenCalledWith(
        'reg-01',
        { status: CashRegisterStatus.INACTIVE },
        mockAdminUser,
      );
    });
  });
});
