import { Module } from '@nestjs/common';
import { Module1Controller } from './module1.controller';
import { Module1Service } from './module1.service';
import { Module2Module } from '../module2/module2.module';

@Module({
  imports: [Module2Module],
  controllers: [Module1Controller],
  providers: [Module1Service],
})
export class Module1Module {}
