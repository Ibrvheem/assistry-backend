// src/wallet/interfaces/wallet.interface.ts
import { Types } from 'mongoose';

export interface IWalletSummary {
  user: Types.ObjectId | string;
  balance_kobo: number;
  currency: string;
}
