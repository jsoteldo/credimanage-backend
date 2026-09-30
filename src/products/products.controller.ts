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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './product.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ProductSaleType } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crediApi/products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @RequirePermissions('product.view')
  async getProducts(
    @Query('q') q?: string,
    @Query('departmentId') departmentId?: string,
    @Query('saleType') saleType?: ProductSaleType,
    @Query('active') active?: string,
  ) {
    return this.productsService.getProducts({
      q,
      departmentId,
      saleType,
      active,
    });
  }

  @Get(':id')
  @RequirePermissions('product.view')
  async getProductById(@Param('id') id: string) {
    return this.productsService.getProductById(id);
  }

  @Get(':id/components')
  @RequirePermissions('product.view')
  async getProductComponents(@Param('id') id: string) {
    const product = await this.productsService.getProductById(id);
    return product.components || [];
  }

  @Post()
  @RequirePermissions('product.create')
  async createProduct(@Body() body: CreateProductDto) {
    return this.productsService.createProduct(body);
  }

  @Put(':id')
  @RequirePermissions('product.edit')
  async updateProduct(@Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.productsService.updateProduct(id, body);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('product.deactivate')
  async deactivateProduct(@Param('id') id: string) {
    return this.productsService.deactivateProduct(id);
  }

  @Patch(':id/reactivate')
  @RequirePermissions('product.deactivate')
  async reactivateProduct(@Param('id') id: string) {
    return this.productsService.reactivateProduct(id);
  }

  @Post('import')
  @RequirePermissions('product.import')
  @UseInterceptors(FileInterceptor('file'))
  async importProducts(
    @UploadedFile() file?: Express.Multer.File,
    @Body('rows') rows?: any,
  ) {
    if (file && file.buffer) {
      return this.productsService.importProductsFile(file.buffer);
    }

    if (rows) {
      const parsedRows = typeof rows === 'string' ? JSON.parse(rows) : rows;
      if (!Array.isArray(parsedRows)) {
        throw new BadRequestException(
          'El formato de las filas debe ser una lista',
        );
      }
      return this.productsService.importProductsRows(parsedRows);
    }

    throw new BadRequestException(
      'Debe proporcionar un archivo Excel (multipart/form-data en "file") o un array de datos en "rows"',
    );
  }
}
