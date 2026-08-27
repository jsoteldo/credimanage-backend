"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    try {
        const app = await core_1.NestFactory.create(app_module_1.AppModule);
        app.enableCors();
        const port = process.env.PORT || 3000;
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