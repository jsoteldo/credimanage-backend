import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    // Aprovechamos y habilitamos CORS para cuando conectes el frontend
    app.enableCors({
      // Agrega tu localhost (puerto 3000 para React/Next o 5173 para Vite)
      // Asegúrate de agregar la URL pública de producción cuando despliegues tu frontend
      origin: ['http://localhost:3000', 'http://localhost:5173', 'https://tu-dominio-frontend.vercel.app'],
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true, // Obligatorio si manejarás cookies o envías el JWT en las cabeceras
    });

    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`🚀 Aplicación arrancada correctamente en el puerto ${port}`);
  } catch (error) {
    console.error('🔥 ERROR FATAL AL ARRANCAR NESTJS:', error);
    process.exit(1);
  }
}
bootstrap();
