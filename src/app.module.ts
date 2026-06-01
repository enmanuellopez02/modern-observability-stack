import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedLoggerModule } from './shared/logger/logger.module';
import { Module1Module } from './module1/module1.module';
import { Module2Module } from './module2/module2.module';
import { Item } from './module2/entities/item.entity';

@Module({
  imports: [
    // ── Database (SQLite via better-sqlite3) ─────────────────────────────
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DB_PATH ?? ':memory:',
      entities: [Item],
      synchronize: true,
      // Enable TypeORM query logging so SQL appears in app logs
      logging: process.env.NODE_ENV !== 'production',
    }),

    // ── Global Pino logger with OTel trace-context mixin ─────────────────
    SharedLoggerModule,

    // ── Feature modules ──────────────────────────────────────────────────
    Module1Module,
    Module2Module,
  ],
})
export class AppModule {}
