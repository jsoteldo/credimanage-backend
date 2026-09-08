import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ExcelImporterService } from './excel-importer.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ExcelImporterService],
  exports: [ProductsService, ExcelImporterService],
})
export class ProductsModule {}
