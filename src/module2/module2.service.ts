import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { Item } from './entities/item.entity';
import { AppLoggerService } from '../shared/logger/logger.service';

const tracer = trace.getTracer('module2', '1.0.0');

/**
 * DataService (Module 2)
 *
 * Owns all SQLite persistence via TypeORM.
 * Every public method is wrapped in an explicit OTel child span so that
 * SQL query details (operation, statement, row counts) appear in Tempo
 * as a dedicated node in the trace waterfall.
 *
 * Load simulation:
 *   LOAD_SIMULATION=cpu     → 500ms CPU-intensive loop per call
 *   LOAD_SIMULATION=memory  → Allocates 50 MB per call (retained in heap)
 * Both modes produce spikes that are clearly visible in Pyroscope profiles.
 */
@Injectable()
export class Module2Service {
  // Intentionally retained to simulate heap growth when LOAD_SIMULATION=memory
  private readonly memoryLeakBucket: Buffer[] = [];

  constructor(
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    private readonly logger: AppLoggerService,
  ) {}

  async findAll(): Promise<Item[]> {
    return tracer.startActiveSpan(
      'db.items.findAll',
      { kind: SpanKind.CLIENT },
      async (span) => {
        span.setAttributes({
          'db.system': 'sqlite',
          'db.operation': 'SELECT',
          'db.sql.table': 'items',
          'db.statement': 'SELECT * FROM items',
        });
        try {
          this.simulateLoad();
          const items = await this.itemRepository.find({
            order: { createdAt: 'DESC' },
          });
          span.setAttribute('db.result.count', items.length);
          this.logger.info('DB findAll completed', { count: items.length });
          return items;
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (err as Error).message,
          });
          this.logger.error('DB findAll failed', err as Error);
          throw err;
        } finally {
          span.end();
        }
      },
    );
  }

  async findOne(id: number): Promise<Item> {
    return tracer.startActiveSpan(
      'db.items.findOne',
      { kind: SpanKind.CLIENT },
      async (span) => {
        span.setAttributes({
          'db.system': 'sqlite',
          'db.operation': 'SELECT',
          'db.sql.table': 'items',
          'db.statement': `SELECT * FROM items WHERE id = ${id}`,
          'item.id': id,
        });
        try {
          this.simulateLoad();
          const item = await this.itemRepository.findOne({ where: { id } });
          if (!item) {
            throw new NotFoundException(`Item #${id} not found`);
          }
          this.logger.info('DB findOne completed', { id, name: item.name });
          return item;
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (err as Error).message,
          });
          if (!(err instanceof NotFoundException)) {
            this.logger.error('DB findOne failed', err as Error, { id });
          }
          throw err;
        } finally {
          span.end();
        }
      },
    );
  }

  async create(data: {
    name: string;
    value: number;
    category?: string;
  }): Promise<Item> {
    return tracer.startActiveSpan(
      'db.items.create',
      { kind: SpanKind.CLIENT },
      async (span) => {
        span.setAttributes({
          'db.system': 'sqlite',
          'db.operation': 'INSERT',
          'db.sql.table': 'items',
          'db.statement':
            'INSERT INTO items (name, value, category) VALUES (?, ?, ?)',
          'item.name': data.name,
          'item.value': data.value,
        });
        try {
          this.simulateLoad();
          const entity = this.itemRepository.create(data);
          const saved = await this.itemRepository.save(entity);
          span.setAttribute('item.id', saved.id);
          this.logger.info('DB create completed', {
            id: saved.id,
            name: saved.name,
          });
          return saved;
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (err as Error).message,
          });
          this.logger.error('DB create failed', err as Error, {
            name: data.name,
          });
          throw err;
        } finally {
          span.end();
        }
      },
    );
  }

  async remove(id: number): Promise<void> {
    return tracer.startActiveSpan(
      'db.items.remove',
      { kind: SpanKind.CLIENT },
      async (span) => {
        span.setAttributes({
          'db.system': 'sqlite',
          'db.operation': 'DELETE',
          'db.sql.table': 'items',
          'db.statement': `DELETE FROM items WHERE id = ${id}`,
          'item.id': id,
        });
        try {
          const item = await this.findOne(id);
          await this.itemRepository.remove(item);
          this.logger.info('DB remove completed', { id });
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (err as Error).message,
          });
          throw err;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Simulates artificial resource pressure to produce visible spikes in
   * Pyroscope profiles. Controlled by the LOAD_SIMULATION environment variable.
   *
   *  "cpu"    → Runs a tight math loop for ~500 ms.
   *             The function name will appear prominently in CPU flame graphs.
   *  "memory" → Allocates a 50 MB Buffer retained in this.memoryLeakBucket.
   *             Heap size grows with every request until the process is restarted.
   */
  private simulateLoad(): void {
    const loadType = process.env.LOAD_SIMULATION;

    if (loadType === 'cpu') {
      this.logger.warn('CPU load simulation active — intentional spike');
      const deadline = Date.now() + 500;
      while (Date.now() < deadline) {
        // Busy-loop: shows up clearly in Pyroscope wall-clock profiles
        let acc = 0;
        for (let i = 0; i < 50_000; i++) {
          acc += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
        }
        // Prevent dead-code elimination
        void acc;
      }
    } else if (loadType === 'memory') {
      const chunkMb = 50;
      const chunk = Buffer.allocUnsafe(chunkMb * 1024 * 1024);
      // Touch every byte so the OS actually commits the memory
      chunk.fill(Math.floor(Math.random() * 256));
      this.memoryLeakBucket.push(chunk);
      this.logger.warn(
        'Memory load simulation active — intentional heap growth',
        {
          chunksRetained: this.memoryLeakBucket.length,
          totalMB: this.memoryLeakBucket.length * chunkMb,
        },
      );
    }
  }
}
