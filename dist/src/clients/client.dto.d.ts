export interface ClientResponseDto {
    id: string;
    clientNumber: string;
    name: string;
    phone: string;
    address: string;
    creditLimit: number;
    currentBalance: number;
    dailyDebtBalance: number;
    bankDebtBalance: number;
    creditExposure: number;
    availableCredit: number | null;
    paymentPeriod: string;
    paymentDay: string;
    nextDueDate: string;
    status: string;
    createdAt: string | Date;
    updatedAt: string | Date;
}
export declare function mapPeriodFromDb(period: any): string;
export declare function toClientDto(c: any): ClientResponseDto | null;
