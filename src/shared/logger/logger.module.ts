import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { trace } from '@opentelemetry/api';
import { AppLoggerService } from './logger.service';

/**
 * Global logger module backed by Pino.
 *
 * Every log entry is automatically enriched with the active OTel
 * traceId / spanId via the mixin function, enabling direct correlation
 * between Loki log lines and Tempo traces inside Grafana.
 *
 * When LOKI_URL is set, logs are streamed to Loki in parallel with stdout.
 */
@Global()
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'debug',

        // Inject active span context into every log record
        mixin() {
          const span = trace.getActiveSpan();
          if (!span) return {};
          const { traceId, spanId, traceFlags } = span.spanContext();
          return { traceId, spanId, traceFlags };
        },

        // Redact sensitive headers if any
        redact: ['req.headers.authorization', 'req.headers.cookie'],

        transport: {
          targets: [
            // ── Human-readable console output (dev only) ──────────────
            {
              target: 'pino-pretty',
              level: process.env.LOG_LEVEL ?? 'debug',
              options: {
                colorize: true,
                singleLine: false,
                translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
                messageFormat: '[{context}] {msg}',
                ignore: 'pid,hostname',
              },
            },
            // ── Loki transport (enabled when LOKI_URL is set) ─────────
            ...(process.env.LOKI_URL
              ? [
                  {
                    target: 'pino-loki',
                    level: 'info',
                    options: {
                      host: process.env.LOKI_URL,
                      labels: {
                        app:
                          process.env.OTEL_SERVICE_NAME ?? 'observability-demo',
                        env: process.env.NODE_ENV ?? 'development',
                      },
                      // traceId / spanId stay in the log body (not labels)
                      // so LogQL can parse them without high-cardinality issues
                      batchSize: 10,
                      interval: 5,
                      silenceErrors: false,
                    },
                  },
                ]
              : []),
          ],
        },

        // Auto-log HTTP requests/responses
        autoLogging: true,
        serializers: {
          req: (req) => ({ method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      },
    }),
  ],
  providers: [AppLoggerService],
  exports: [AppLoggerService, LoggerModule],
})
export class SharedLoggerModule {}
