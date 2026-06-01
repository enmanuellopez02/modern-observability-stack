/**
 * Pyroscope continuous profiling bootstrap.
 * Pushes CPU (wall-clock) and heap profiles to the Pyroscope server.
 * The LOAD_SIMULATION env var triggers artificial CPU / memory pressure in
 * Module2Service so that the spike is clearly visible in the flame graphs.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
let Pyroscope: any;
try {
  Pyroscope = require('@pyroscope/nodejs');
} catch {
  console.warn(
    '[Pyroscope] Native module not available — profiling disabled. ' +
      'Run `npm install` with build tools available to enable it.',
  );
}

const serverAddress =
  process.env.PYROSCOPE_SERVER_URL ?? 'http://localhost:4040';
const enabled = process.env.PYROSCOPE_ENABLED !== 'false' && !!Pyroscope;

if (enabled) {
  Pyroscope.init({
    serverAddress,
    appName: process.env.OTEL_SERVICE_NAME ?? 'observability-demo',
    tags: {
      environment: process.env.NODE_ENV ?? 'development',
      version: process.env.npm_package_version ?? '1.0.0',
    },
  });
  Pyroscope.start();
  console.log(`[Pyroscope] Profiling started → ${serverAddress}`);
}
