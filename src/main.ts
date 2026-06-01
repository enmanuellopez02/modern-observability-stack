// ── Bootstrap order matters ────────────────────────────────────────────────
// tracing.ts MUST be the first import so OTel patches all modules before they
// are loaded. profiling.ts starts Pyroscope CPU/heap sampling.
import './tracing';
import './profiling';
// ──────────────────────────────────────────────────────────────────────────

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Buffer logs until the Pino logger is attached
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Application running on http://localhost:${port}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
