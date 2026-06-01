import { Injectable } from '@nestjs/common';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { Module2Service } from '../module2/module2.service';
import { AppLoggerService } from '../shared/logger/logger.service';

const tracer = trace.getTracer('module1', '1.0.0');

/**
 * ProcessingService (Module 1)
 *
 * Business-logic layer. Delegates all data access to Module2Service,
 * which owns the SQLite repository. Each method adds an OTel child span
 * so the full call chain (HTTP → Module1 → Module2 → SQLite) is visible
 * as a single correlated trace in Tempo.
 */
@Injectable()
export class Module1Service {
  constructor(
    private readonly dataService: Module2Service,
    private readonly logger: AppLoggerService,
  ) {}

  async processAll() {
    return tracer.startActiveSpan('processing.processAll', async (span) => {
      try {
        this.logger.info('Processing all items');
        const items = await this.dataService.findAll();
        const result = {
          count: items.length,
          processedAt: new Date().toISOString(),
          source: 'module1',
          items: items.map((item) => ({
            ...item,
            processed: true,
          })),
        };
        span.setAttribute('result.count', result.count);
        this.logger.info('All items processed successfully', {
          count: result.count,
        });
        return result;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (err as Error).message,
        });
        this.logger.error('Failed to process all items', err as Error);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  async processOne(id: number) {
    return tracer.startActiveSpan('processing.processOne', async (span) => {
      span.setAttribute('item.id', id);
      try {
        this.logger.info('Processing single item', { id });
        const item = await this.dataService.findOne(id);
        const result = {
          ...item,
          processedAt: new Date().toISOString(),
          source: 'module1',
          processed: true,
        };
        this.logger.info('Item processed successfully', {
          id,
          name: item.name,
        });
        return result;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (err as Error).message,
        });
        this.logger.error('Failed to process item', err as Error, { id });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  async processCreate(data: {
    name: string;
    value: number;
    category?: string;
  }) {
    return tracer.startActiveSpan('processing.processCreate', async (span) => {
      span.setAttribute('item.name', data.name);
      try {
        this.logger.info('Creating and processing item', { name: data.name });
        const item = await this.dataService.create(data);
        const result = {
          ...item,
          processedAt: new Date().toISOString(),
          source: 'module1',
          processed: true,
        };
        span.setAttribute('item.id', item.id);
        this.logger.info('Item created and processed', {
          id: item.id,
          name: item.name,
        });
        return result;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (err as Error).message,
        });
        this.logger.error('Failed to create item', err as Error, {
          name: data.name,
        });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  async processRemove(id: number) {
    return tracer.startActiveSpan('processing.processRemove', async (span) => {
      span.setAttribute('item.id', id);
      try {
        this.logger.info('Removing item', { id });
        await this.dataService.remove(id);
        this.logger.info('Item removed successfully', { id });
        return { id, removed: true, processedAt: new Date().toISOString() };
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (err as Error).message,
        });
        this.logger.error('Failed to remove item', err as Error, { id });
        throw err;
      } finally {
        span.end();
      }
    });
  }
}
