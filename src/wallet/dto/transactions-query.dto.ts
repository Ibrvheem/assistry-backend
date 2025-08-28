// dto/transactions-query.dto.ts
import { IsIn, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class TransactionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 20;

  @IsOptional()
  @IsIn(['credit', 'debit', 'all'])
  type?: 'credit' | 'debit' | 'all' = 'all';

  @IsOptional()
  _: string;
}
