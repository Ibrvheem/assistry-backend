// src/wallet/wallet.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, Document } from 'mongoose';
import { Wallet } from './schemas/wallet.schema';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from './schemas/transaction.schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';

/**
 * Local aliases that require a concrete _id on the document.
 * We keep these local so we don't change your schema files.
 */
type WalletWithId = Wallet & Document & { _id: Types.ObjectId };
type TransactionWithId = Transaction & Document & { _id: Types.ObjectId };

// at the top of src/wallet/wallet.service.ts (add these imports)
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// make sure you already have these types in this file:
// type WalletWithId = Wallet & Document & { _id: Types.ObjectId };
// type TransactionWithId = Transaction & Document & { _id: Types.ObjectId };

const PAYSTACK_BASE = 'https://api.paystack.co';
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET || ''; // make sure env var is set


@Injectable()
export class WalletService {
  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<Wallet & Document>,
    @InjectModel(Transaction.name) private txModel: Model<Transaction & Document>,
  ) {}

  /** Helper to normalize userId to ObjectId without using global String() */
//   private toObjectId(id: string | Types.ObjectId): Types.ObjectId {
//     if (id instanceof Types.ObjectId) return id;
//     return new Types.ObjectId(String(id));
//   }

  /**
   * Ensure a wallet exists for a user and return it.
   * Returns WalletWithId to guarantee _id is present for callers.
   */
  async createWalletForUser(userId: string | Types.ObjectId): Promise<WalletWithId> {
    const uid = userId;
    const existing = (await this.walletModel.findOne({ user: uid }).exec()) as WalletWithId | null;
    if (existing) return existing;

    const created = (await this.walletModel.create({
      user: uid,
      balance_kobo: 0,
      currency: 'NGN',
    })) as unknown as WalletWithId; // cast create result to WalletWithId
    return created;
  }



  /**
   * Get or create wallet for the user.
   * Return type guarantees _id exists.
   */
  async getOrCreateWallet(userId: string | Types.ObjectId): Promise<WalletWithId> {
    const uid = userId;
    let wallet = (await this.walletModel.findOne({ user: uid }).exec()) as WalletWithId | null;
    if (!wallet) wallet = await this.createWalletForUser(uid);
    return wallet;
  }



  /**
   * Get wallet by user (throws if not found).
   */
  async getWalletByUser(userId: string | Types.ObjectId): Promise<WalletWithId> {
    const uid = userId;
    const wallet = (await this.walletModel.findOne({ user: uid }).exec()) as WalletWithId | null;
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  /**
   * List transactions for a user's wallet with pagination.
   * We return full Mongoose documents typed as TransactionWithId[].
   */
  // async listTransactionsForUser(
  //   userId: string | Types.ObjectId,
  //   page = 1,
  //   limit = 20,
  // ): Promise<{ data: TransactionWithId[]; meta: { page: number; limit: number; total: number } }> {
  //   const wallet = await this.getOrCreateWallet(userId);
  //   const skip = (page - 1) * limit;

  //   const rows = (await this.txModel
  //     .find({ wallet: wallet._id })
  //     .sort({ createdAt: -1 })
  //     .skip(skip)
  //     .limit(limit)
  //     .exec()) as TransactionWithId[];

  //   const count = await this.txModel.countDocuments({ wallet: wallet._id }).exec();

  //   return { data: rows, meta: { page, limit, total: count } };
  // }

  async listTransactionsForUser(
      userId: string | Types.ObjectId,
      page = 1,
      limit = 20,
      type?: TransactionType | 'all',
    ): Promise<{ data: TransactionWithId[]; meta: { page: number; limit: number; total: number } }> {
      const wallet = await this.getOrCreateWallet(userId);
      const skip = (page - 1) * limit;

      const filter: any = { wallet: wallet._id };
      if (type && type !== 'all') {
        filter.type = type;
      }

      const [rows, count] = await Promise.all([
        this.txModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec() as Promise<TransactionWithId[]>,
        this.txModel.countDocuments(filter).exec(),
      ]);

      return { data: rows, meta: { page, limit, total: count } };
    }


  /**
   * Create a transaction idempotently using the provided reference.
   * Returns TransactionWithId so callers can rely on _id presence.
   */
  async createTransaction(userId: string | Types.ObjectId, dto: CreateTransactionDto): Promise<TransactionWithId> {
    const wallet = await this.getOrCreateWallet(userId);

    // Idempotency: return existing transaction if found
    const existing = (await this.txModel.findOne({ reference: dto.reference }).exec()) as TransactionWithId | null;
    if (existing) return existing;

    // Create pending transaction (cast to TransactionWithId)
    const tx = (await this.txModel.create({
      wallet: wallet._id,
      type: dto.type,
      amount_kobo: dto.amount_kobo,
      reference: dto.reference,
      status: TransactionStatus.PENDING,
      metadata: dto.metadata ?? {},
    })) as unknown as TransactionWithId;

    // Apply amount
    if (dto.type === TransactionType.CREDIT) {
      // atomic increment for credit
      await this.walletModel.findByIdAndUpdate(wallet._id, { $inc: { balance_kobo: dto.amount_kobo } }, { new: true }).exec();

      tx.status = TransactionStatus.SUCCESS;
      await tx.save();
      return tx;
    }

    if (dto.type === TransactionType.DEBIT) {
      // Attempt atomic decrement only if enough balance
      const updated = await this.walletModel.findOneAndUpdate(
        { _id: wallet._id, balance_kobo: { $gte: dto.amount_kobo } },
        { $inc: { balance_kobo: -dto.amount_kobo } },
        { new: true },
      ).exec();

      if (!updated) {
        tx.status = TransactionStatus.FAILED;
        await tx.save();
        throw new BadRequestException('Insufficient balance');
      }

      tx.status = TransactionStatus.SUCCESS;
      await tx.save();
      return tx;
    }

    // Unknown type
    tx.status = TransactionStatus.FAILED;
    await tx.save();
    throw new BadRequestException('Invalid transaction type');
  }


  async Initialize(userId: string | Types.ObjectId, amount_kobo: number, email: string): Promise<WalletWithId> {
    // 1) ensure wallet exists
        const wallet = await this.getOrCreateWallet(userId); // returns WalletWithId

        // 2) create a server-side unique reference (idempotency)
        const reference = `psk_${uuidv4()}`;

        // 3) create a pending transaction record (idempotent by reference)
        //    cast to TransactionWithId to satisfy callers expecting _id present
        const tx = (await this.txModel.create({
            wallet: wallet._id,
            type: TransactionType.CREDIT,
            amount_kobo,
            reference,
            status: TransactionStatus.PENDING,
            metadata: { email },
        })) as unknown as TransactionWithId;

        // 4) Prepare payload for Paystack initialize
        const payload: Record<string, any> = {
            amount: amount_kobo,
            email,
            reference,
            callback_url: "https://15b17e569045.ngrok-free.app/paystack/callback",
            metadata: {
            user_id: String(wallet.user), // attach user mapping so webhook/verify can find user
            wallet_id: String(wallet._id),
            local_reference: reference,
            },
        };

        // 5) Call Paystack initialize endpoint
        try {
            console.log(PAYSTACK_SECRET)
            const res = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, payload, {
            headers: {
                Authorization: `Bearer sk_test_9c1a6166689818e08f0347c90cd1844447307b9c`,
                'Content-Type': 'application/json',
            },
            timeout: 20000,
            });

            // paystack returns { status: true, message: "...", data: { authorization_url, reference, ... } }
            const paystackData = res.data?.data ?? null;

            // 6) Save Paystack response into the transaction metadata (so verify/webhook can use it)
            tx.metadata = {
            ...(tx.metadata || {}),
            paystack_init: paystackData,
            };
            await tx.save();

            // 7) Attach the init payload to the returned wallet object at runtime (no schema change).
            //    This lets your controller access authorization_url & reference from the returned wallet.
            (wallet as any).last_paystack_init = paystackData; // runtime-only property

            // 8) return wallet (with runtime last_paystack_init)
            return wallet;
        } catch (err: any) {
            // If Paystack init failed, mark transaction failed and surface error
            try {
            tx.status = TransactionStatus.FAILED;
            tx.metadata = {
                ...(tx.metadata || {}),
                paystack_error: (err?.response?.data ?? err?.message ?? String(err)),
            };
            await tx.save();
            } catch (saveErr) {
            // swallow save error but log in real app
            console.error('Failed to save failed tx metadata:', saveErr);
            }

            // throw a clear error so controller can respond correctly
            throw new Error(`Paystack initialize failed: ${err?.response?.data?.message ?? err?.message ?? String(err)}`);
        }
    }


    async handlePaystackEvent(event: any) {
        console.log(`Paystack event: ${event.event}`);

        if (event.event === 'charge.success') {
        const { reference, amount, customer } = event.data;

        // find existing pending transaction by reference
        const tx = await this.txModel.findOne({ reference });

        if (!tx) {
            console.error(`Transaction not found for reference: ${reference}`);
            return;
        }

        if (tx.status === TransactionStatus.SUCCESS) {
            console.log(`Transaction ${reference} already processed`);
            return;
        }

        // update transaction status
        tx.status = TransactionStatus.SUCCESS;
        await tx.save();

        // update wallet balance
        await this.walletModel.findByIdAndUpdate(tx.wallet, {
            $inc: { balance_kobo: amount }, // Paystack amount is in kobo, adjust if necessary
        });

        console.log(`Wallet credited for transaction: ${reference}`);
        }

        if (event.event === 'charge.failed') {
        const { reference } = event.data;
        await this.txModel.updateOne(
            { reference },
            { status: TransactionStatus.FAILED },
        );
        }
  }


  /**
   * Convenience wrappers using reference for idempotency.
   */
  async creditByReference(userId: string | Types.ObjectId, amount_kobo: number, reference: string, metadata?: Record<string, any>): Promise<TransactionWithId> {
    const dto: CreateTransactionDto = { type: TransactionType.CREDIT, amount_kobo, reference, metadata };
    return this.createTransaction(userId, dto);
  }

  async debitByReference(userId: string | Types.ObjectId, amount_kobo: number, reference: string, metadata?: Record<string, any>): Promise<TransactionWithId> {
    const dto: CreateTransactionDto = { type: TransactionType.DEBIT, amount_kobo, reference, metadata };
    return this.createTransaction(userId, dto);
  }
}
