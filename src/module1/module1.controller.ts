import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Module1Service } from './module1.service';
import { AppLoggerService } from '../shared/logger/logger.service';

/**
 * ProcessingController (Module 1)
 *
 * Entry point for all HTTP requests. Delegates to ProcessingService which
 * in turn calls Module2Service → SQLite. The full chain is captured as a
 * single distributed trace visible in Tempo.
 */
@Controller('process')
export class Module1Controller {
  constructor(
    private readonly processingService: Module1Service,
    private readonly logger: AppLoggerService,
  ) {}

  /** List and process all items */
  @Get()
  getAll() {
    this.logger.info('GET /process — list all');
    return this.processingService.processAll();
  }

  /** Get and process a single item by id */
  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.info('GET /process/:id', { id });
    return this.processingService.processOne(id);
  }

  /**
   * Create a new item.
   * Set LOAD_SIMULATION=cpu or LOAD_SIMULATION=memory in .env to trigger
   * an artificial spike that is detectable in Pyroscope profiles.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: { name: string; value: number; category?: string }) {
    this.logger.info('POST /process — create item', { name: body.name });
    return this.processingService.processCreate(body);
  }

  /** Remove an item */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.info('DELETE /process/:id', { id });
    return this.processingService.processRemove(id);
  }
}
