import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

/**
 * Application-wide structured logger.
 *
 * Wraps nestjs-pino's PinoLogger and exposes a typed API.
 * The active OTel span context (traceId, spanId) is injected
 * automatically via the global mixin configured in SharedLoggerModule,
 * so callers do not need to pass trace fields explicitly.
 */
@Injectable()
export class AppLoggerService {
  constructor(
    @InjectPinoLogger(AppLoggerService.name)
    private readonly logger: PinoLogger,
  ) {}

  info(message: string, context?: Record<string, unknown>): void {
    this.logger.info(context ?? {}, message);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.logger.warn(context ?? {}, message);
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    this.logger.error({ err: error, ...context }, message);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.logger.debug(context ?? {}, message);
  }
}
