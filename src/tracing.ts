/**
 * OpenTelemetry SDK bootstrap.
 * MUST be the very first import in main.ts so that all instrumented
 * packages (HTTP, NestJS, TypeORM, better-sqlite3, etc.) are patched
 * before they are first required.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const otlpEndpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';
const serviceName = process.env.OTEL_SERVICE_NAME ?? 'observability-demo';

const sdk = new NodeSDK({
  resource: new Resource({
    'service.name': serviceName,
    'service.version': process.env.npm_package_version ?? '1.0.0',
    'deployment.environment': process.env.NODE_ENV ?? 'development',
  }),

  // ── Traces ── OTLP HTTP → Alloy → Tempo
  traceExporter: new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  }),

  // ── Metrics ── OTLP HTTP → Alloy → Mimir (remote_write)
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${otlpEndpoint}/v1/metrics`,
    }),
    exportIntervalMillis: 15_000,
  }),

  // Auto-instrument HTTP, Express, NestJS, TypeORM, and more
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable fs instrumentation to avoid noise
      '@opentelemetry/instrumentation-fs': { enabled: false },
      // Capture HTTP request/response bodies in spans
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        requestHook: (span, req) => {
          span.setAttribute('http.request.method', (req as any).method ?? '');
        },
      },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
});
