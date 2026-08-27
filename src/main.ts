import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    // Aprovechamos y habilitamos CORS para cuando conectes el frontend
    app.enableCors();

    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`🚀 Aplicación arrancada correctamente en el puerto ${port}`);
  } catch (error) {
    console.error('🔥 ERROR FATAL AL ARRANCAR NESTJS:', error);
    process.exit(1);
  }
}
bootstrap();
