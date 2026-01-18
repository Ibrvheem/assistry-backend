import { Module } from '@nestjs/common';
import { InstitutionService } from './institution.service';
import { InstitutionController } from './institution.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { InstitutionSchema } from './institution.schema';
import { UsersModule } from 'src/users/users.module';

@Module({
  controllers: [InstitutionController],
  providers: [InstitutionService, UsersModule],
  imports: [
    MongooseModule.forFeature([
      { name: 'Institution', schema: InstitutionSchema },
    ]),
    UsersModule,
  ],
  exports: [InstitutionService, MongooseModule],
})
export class InstitutionModule {}
