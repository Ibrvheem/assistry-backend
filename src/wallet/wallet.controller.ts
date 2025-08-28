// src/wallet/wallet.controller.ts
import { Controller, Get, Post, Body, Query, UseGuards, Headers,
  Req,
  Res,
  HttpException,
  HttpStatus} from '@nestjs/common';
import { Response, Request } from 'express';
import { WalletService } from './wallet.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
// import { JwtGuard } from '../guards/jwt.guard';
import { User as UserDecorator } from 'decorators/user.decorator';
import * as crypto from 'crypto';
import { Public } from 'decorators/public.decorator';
import { TransactionsQueryDto } from './dto/transactions-query.dto';
import { TransactionType } from './schemas/transaction.schema';

// @UseGuards(JwtGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // GET /wallet  -> fetch the user's wallet summary
  @Get()
  async getWallet(@UserDecorator() user: any) {
    
    const wallet = await this.walletService.getOrCreateWallet(user._id ?? user.id ?? user.userId);
    // console.log(wallet)
    return { status: 'ok', data: wallet };
  }

  // GET /api/wallet/transactions?page=1&limit=20
  // @Get('transactions')
  // async transactions(@UserDecorator() user: any, @Query('page') page = '1', @Query('limit') limit = '20') {
  //   const pageN = parseInt(String(page), 10) || 1;
  //   const limitN = parseInt(String(limit), 10) || 20;
  //   const res = await this.walletService.listTransactionsForUser(user._id ?? user.id ?? user.userId, pageN, limitN);
  //   return { status: 'ok', ...res };
  // }

  // @Get('transactions')
  // async transactions(
  //   @UserDecorator() user: any,
  //   @Query('page') page = '1',
  //   @Query('limit') limit = '20',
  //   @Query('type') type?: string, // expected: 'credit' | 'debit' | undefined
  // ) {
  //   const pageN = parseInt(String(page), 10) || 1;
  //   const limitN = parseInt(String(limit), 10) || 20;
  //   const userId = user._id ?? user.id ?? user.userId;

  //   let res;
  //   if (type === 'credit') {
  //     // call the credit-specific service
  //     res = await this.walletService.listCreditTransactionsForUser(userId, pageN, limitN);
  //   } else if (type === 'debit') {
  //     // call the debit-specific service
  //     res = await this.walletService.listDebitTransactionsForUser(userId, pageN, limitN);
  //   } else {
  //     // default: all transactions
  //     res = await this.walletService.listTransactionsForUser(userId, pageN, limitN);
  //   }

  //   return { status: 'ok', ...res };
  // }

  @Get('transactions')
async transactions(
      @UserDecorator() user: any,
      @Query() q: TransactionsQueryDto,
    ) {
      console.log(q);
      const pageN = q.page ?? 1;
      const limitN = q.limit ?? 20;
      const userId = user._id ?? user.id ?? user.userId;

      const typeFilter =
        q.type === 'credit' ? TransactionType.CREDIT :
        q.type === 'debit'  ? TransactionType.DEBIT  :
        undefined; // 'all' -> undefined

      const res = await this.walletService.listTransactionsForUser(
        userId,
        pageN,
        limitN,
        typeFilter,
      );

      return { status: 'ok', ...res };
    }

  // POST /api/wallet/transaction  -> create tx (credit / debit). This endpoint can be used by internal systems.
  @Post('transaction')
  async createTransaction(@UserDecorator() user: any, @Body() dto: CreateTransactionDto) {
    const tx = await this.walletService.createTransaction(user._id ?? user.id ?? user.userId, dto);
    return { status: 'ok', data: tx };
  }

  @Post('deposit')
  async deposit(@UserDecorator() user: any, @Body() body: { amount_kobo: number;}) {
    const { amount_kobo} = body;
    console.log(body)

    const email = user.email ?? 'jamalazimabdullahi@gmail.com';

    const wallet = await this.walletService.Initialize(user._id ?? user.id ?? user.userId, amount_kobo, email);
    const init = (wallet as any).last_paystack_init;
    console.log(init)
    return { authorization_url: init?.authorization_url, reference: init?.reference };

  }


  // Convenience endpoints for topup/debit using simple payloads:
  // POST /api/wallet/topup  { amount_kobo, reference, metadata? }
  @Post('topup')
  async topup(@UserDecorator() user: any, @Body() body: { amount_kobo: number; reference: string; metadata?: Record<string, any> }) {
    const { amount_kobo, reference, metadata } = body;
    const tx = await this.walletService.creditByReference(user._id ?? user.id ?? user.userId, amount_kobo, reference, metadata);
    return { status: 'ok', data: tx };
  }

  // POST /api/wallet/debit { amount_kobo, reference, metadata? }
  @Post('debit')
  async debit(@UserDecorator() user: any, @Body() body: { amount_kobo: number; reference: string; metadata?: Record<string, any> }) {
    const { amount_kobo, reference, metadata } = body;
    const tx = await this.walletService.debitByReference(user._id ?? user.id ?? user.userId, amount_kobo, reference, metadata);
    return { status: 'ok', data: tx };
  }

  // @Post('paystack/webhook')
  // async handlePaystackWebhook(
  //   @Headers('x-paystack-signature') signature: string,
  //   @Req() req: Request,
  //   @Res() res: Response,
  // ) {
  //   console.log('jkjk')
  //   try {
  //     const secret = 'sk_test_f854103fa9d4f843a8a70b4810ec3cd62a905905';
  //     const hash = crypto
  //       .createHmac('sha512', secret)
  //       .update(JSON.stringify(req.body))
  //       .digest('hex');

  //     if (hash !== signature) {
  //       throw new HttpException('Invalid signature', HttpStatus.FORBIDDEN);
  //     }

  //     const event = req.body;
  //     await this.walletService.handlePaystackEvent(event);

  //     return res.status(200).send({ received: true });
  //   } catch (error) {
  //     console.error('Webhook error:', error);
  //     return res.status(500).json({ error: 'Webhook handling failed' });
  //   }
  // }

  @Public()
  @Post('paystack/webhook')
async handlePaystackWebhook(
  @Headers('x-paystack-signature') signature: string,
  @Req() req: any, // not Request, since we need rawBody
  @Res() res: Response,
) {
  try {
    const secret = 'sk_test_f854103fa9d4f843a8a70b4810ec3cd62a905905';
    const hash = crypto
      .createHmac('sha512', secret)
      .update(req.body) // already raw buffer
      .digest('hex');

    if (hash !== signature) {
      throw new HttpException('Invalid signature', HttpStatus.FORBIDDEN);
    }

    const event = JSON.parse(req.body.toString());
    console.log(event)
    await this.walletService.handlePaystackEvent(event);

    return res.status(200).send({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Webhook handling failed' });
  }
}


  
}
