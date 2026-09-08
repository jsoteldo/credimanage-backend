import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { LocationType } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crediApi/locations')
export class LocationsController {
  constructor(private locationsService: LocationsService) {}

  @Get()
  @RequirePermissions('location.view')
  async getLocations(
    @Query('type') type?: LocationType,
    @Query('active') active?: string,
    @Query('q') q?: string,
  ) {
    return this.locationsService.getLocations({ type, active, q });
  }

  @Get(':id')
  @RequirePermissions('location.view')
  async getLocationById(@Param('id') id: string) {
    return this.locationsService.getLocationById(id);
  }

  @Post()
  @RequirePermissions('location.manage')
  async createLocation(@Body() body: any) {
    return this.locationsService.createLocation(body);
  }

  @Put(':id')
  @RequirePermissions('location.manage')
  async updateLocation(@Param('id') id: string, @Body() body: any) {
    return this.locationsService.updateLocation(id, body);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('location.manage')
  async deactivateLocation(@Param('id') id: string) {
    return this.locationsService.deactivateLocation(id);
  }

  @Patch(':id/reactivate')
  @RequirePermissions('location.manage')
  async reactivateLocation(@Param('id') id: string) {
    return this.locationsService.reactivateLocation(id);
  }
}
