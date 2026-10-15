import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    // Permitir orígenes de desarrollo, producción (Vercel) y orígenes configurados en variables de entorno
    const allowedOrigins: (string | RegExp)[] = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://credimanage-frontend-5u4rn8f0j-credimanage.vercel.app',
      /\.vercel\.app$/,
    ];

    if (process.env.FRONTEND_URL) {
      process.env.FRONTEND_URL.split(',').forEach((origin) => {
        const trimmed = origin.trim();
        if (trimmed) allowedOrigins.push(trimmed);
      });
    }

    // Aprovechamos y habilitamos CORS para cuando conectes el frontend
    app.enableCors({
      origin: allowedOrigins,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true, // Obligatorio si manejarás cookies o envías el JWT en las cabeceras
    });

    // Cierre limpio de conexiones y pools al recibir SIGTERM en Google Cloud Run
    app.enableShutdownHooks();

    const port = process.env.PORT || 8080;
    await app.listen(port, '0.0.0.0');
    console.log(`🚀 Aplicación arrancada correctamente en el puerto ${port}`);
  } catch (error) {
    console.error('🔥 ERROR FATAL AL ARRANCAR NESTJS:', error);
    process.exit(1);
  }
}
bootstrap();
