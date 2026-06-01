# Modern Observability Stack

Full-stack observability demo built with **NestJS** + **OpenTelemetry**, visualised in **Grafana** using the complete LGTM+P stack.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  NestJS App  (localhost:3001)                                            │
│                                                                          │
│  HTTP → Module1Controller → Module1Service → Module2Service → SQLite    │
│                                                                          │
│  ├── OTLP HTTP (traces + metrics) ──────────→ Alloy :4318               │
│  ├── pino-loki (structured JSON logs) ──────→ Loki  :3100               │
│  └── @pyroscope/nodejs (CPU + heap) ────────→ Pyroscope :4040           │
└──────────────────────────────────────────────────────────────────────────┘

Alloy  ──traces──→  Tempo  (local storage)
Alloy  ──metrics──→ Mimir  (S3 blocks on MinIO)

Grafana  →  queries Mimir + Loki + Tempo + Pyroscope
```

| Service    | Purpose                     | URL                      |
|------------|-----------------------------|--------------------------|
| App        | NestJS REST API             | http://localhost:3001    |
| Grafana    | Unified dashboards          | http://localhost:3000    |
| Alloy      | Telemetry pipeline UI       | http://localhost:12345   |
| Mimir      | Metrics (remote_write)      | http://localhost:9009    |
| Loki       | Log aggregation             | http://localhost:3100    |
| Tempo      | Distributed tracing         | http://localhost:3200    |
| Pyroscope  | Continuous profiling        | http://localhost:4040    |
| MinIO      | S3 object storage           | http://localhost:9001    |

## Quick start

### 1. Start the infrastructure
```bash
docker-compose up -d
# Wait ~30 s for all services to become healthy
docker-compose ps
```

### 2. Install app dependencies
```bash
npm install
```

> **Note:** `@pyroscope/nodejs` requires native build tools.
> macOS: `xcode-select --install` | Linux: `apt install build-essential python3`

### 3. Start the app
```bash
npm run start:dev
```

### 4. Generate traffic
```bash
# Create items
curl -s -X POST http://localhost:3001/process \
  -H 'Content-Type: application/json' \
  -d '{"name":"widget-a","value":42,"category":"demo"}' | jq

curl -s http://localhost:3001/process | jq          # list all
curl -s http://localhost:3001/process/1 | jq        # get one
curl -s -X DELETE http://localhost:3001/process/1   # delete
```

### 5. Open Grafana
http://localhost:3000 → **Observability Demo** folder → **Overview** dashboard.

## Trace → Log → Metric correlation
1. In Tempo, click any trace row to expand the waterfall.
2. The side-panel shows **"Logs for this span"** (Loki query by traceId) and
   **"Metrics"** (Mimir RED metrics derived from spans by Tempo's metrics generator).
3. In Loki, any log line with a `TraceID` field shows a direct link back to Tempo.

## Load simulation (Pyroscope demo)

Set `LOAD_SIMULATION` in `.env` and restart the app:

| Value    | Effect                                  | Visible in            |
|----------|-----------------------------------------|-----------------------|
| `cpu`    | 500 ms CPU loop per DB call             | Pyroscope CPU graph   |
| `memory` | +50 MB heap retained per DB call        | Pyroscope heap graph  |
| *(empty)*| Normal operation                        | —                     |

```bash
# Trigger CPU spike then hammer the endpoint
LOAD_SIMULATION=cpu npm run start:dev &
for i in $(seq 1 20); do
  curl -s -X POST http://localhost:3001/process \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"item-$i\",\"value\":$i}" > /dev/null
done
```

Open Pyroscope → http://localhost:4040 or the flame-graph panels in Grafana.
The `simulateLoad` function will dominate the CPU profile, pointing clearly to
`Module2Service` as the origin of the spike.

## Project structure

```
src/
├── tracing.ts                   ← OTel SDK init (MUST be first import)
├── profiling.ts                 ← Pyroscope init
├── main.ts
├── app.module.ts
├── shared/logger/
│   ├── logger.module.ts         ← Global Pino (mixin injects traceId/spanId)
│   └── logger.service.ts
├── module1/
│   ├── module1.controller.ts    ← HTTP endpoints
│   └── module1.service.ts       ← Calls Module2, adds OTel spans
└── module2/
    ├── module2.service.ts       ← SQLite + load simulation
    └── entities/item.entity.ts

docker/
├── alloy/config.alloy           ← OTLP pipeline (app → Tempo & Mimir)
├── mimir/mimir.yaml             ← Monolithic + S3 on MinIO
├── loki/loki.yaml
├── tempo/tempo.yaml             ← + span-metrics generator → Mimir
└── grafana/provisioning/
    ├── datasources/             ← Mimir, Loki, Tempo, Pyroscope
    └── dashboards/              ← overview.json
```
