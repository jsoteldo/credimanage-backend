"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    try {
        const app = await core_1.NestFactory.create(app_module_1.AppModule);
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5173',
            'https://credimanage-frontend-5u4rn8f0j-credimanage.vercel.app',
            /\.vercel\.app$/,
        ];
        if (process.env.FRONTEND_URL) {
            process.env.FRONTEND_URL.split(',').forEach((origin) => {
                const trimmed = origin.trim();
                if (trimmed)
                    allowedOrigins.push(trimmed);
            });
        }
        app.use((req, res, next) => {
            const urlPath = (req.url || '').split('?')[0];
            if (!urlPath.startsWith('/crediApi') &&
                urlPath !== '/' &&
                urlPath !== '/health') {
                req.url = '/crediApi' + (req.url.startsWith('/') ? req.url : '/' + req.url);
            }
            next();
        });
        app.enableCors({
            origin: allowedOrigins,
            methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
            credentials: true,
        });
        app.enableShutdownHooks();
        const port = process.env.PORT || 8080;
        await app.listen(port, '0.0.0.0');
        console.log(`🚀 Aplicación arrancada correctamente en el puerto ${port}`);
    }
    catch (error) {
        console.error('🔥 ERROR FATAL AL ARRANCAR NESTJS:', error);
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map