import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp, registerBigIntSerialisation } from './app.setup.js';
import { config } from './config.js';

registerBigIntSerialisation();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(config.port);
}

await bootstrap();
