// src/wallet/schemas/wallet.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WalletDocument = Wallet & Document;

@Schema({ timestamps: true })
export class Wallet {
  @Prop({
    type: Types.ObjectId,
    required: true,
    ref: 'User',
    index: true,
    unique: true,
  })
  user: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  balance_kobo: number;

  @Prop({ default: 'NGN' })
  currency: string;

  @Prop({ type: Number, default: 0 })
  debt_kobo: number;

  @Prop({ default: false })
  disabled: boolean;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);
WalletSchema.index({ user: 1 }, { unique: true });
