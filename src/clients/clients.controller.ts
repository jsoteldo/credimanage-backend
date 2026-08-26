import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('crediApi/clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  async getClients(@Query('q') q?: string, @Query('status') status?: string) {
    return this.clientsService.getClients(q, status);
  }

  @Post()
  async createClient(@Body() body: any, @Req() req: any) {
    return this.clientsService.createClient(body, req.user);
  }

  @Put(':id')
  async updateClient(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.clientsService.updateClient(id, body, req.user);
  }

  @Post(':id/deactivate')
  async deactivateClient(@Param('id') id: string, @Req() req: any) {
    return this.clientsService.deactivateClient(id, req.user);
  }

  @Post(':id/reactivate')
  async reactivateClient(@Param('id') id: string, @Req() req: any) {
    return this.clientsService.reactivateClient(id, req.user);
  }

  @Delete(':id')
  async deleteClient(@Param('id') id: string, @Req() req: any) {
    return this.clientsService.deleteClient(id, req.user);
  }

  @Get(':id/statement')
  async getStatement(@Param('id') id: string) {
    return this.clientsService.getStatement(id);
  }
}
