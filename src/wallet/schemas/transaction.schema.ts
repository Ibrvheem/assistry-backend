// src/wallet/schemas/transaction.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TransactionDocument = Transaction & Document ;

export enum TransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: Types.ObjectId, ref: 'Wallet', required: true, index: true })
  wallet: Types.ObjectId;

  @Prop({ enum: Object.values(TransactionType), required: true })
  type: TransactionType;

  @Prop({ type: Number, required: true }) // stored in kobo
  amount_kobo: number;

  // optional unique reference to make operations idempotent
  @Prop({ type: String, required: true, index: true, unique: true })
  reference: string;

  @Prop({ enum: Object.values(TransactionStatus), default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.index({ reference: 1 }, { unique: true });
