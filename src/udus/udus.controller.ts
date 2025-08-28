import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UdusService } from './udus.service';
import { CreateUdusDto } from './dto/create-udus.dto';
import { UpdateUdusDto } from './dto/update-udus.dto';
import { Public } from 'decorators/public.decorator';
import { UsersService } from 'src/users/users.service';
import { REGSTATUS } from 'src/users/types';
import { UDUS } from './udus.schema';

@Controller('udus')
@Public()
export class UdusController {
  constructor(
    private readonly udusService: UdusService,
    private readonly userService: UsersService,
  ) {}

  @Post('/create')
  async createUdus(@Body() student: Partial<UDUS>) {
    return this.udusService.create(student);
  }
  

  @Post()
  async create(@Body() { reg_no }: { reg_no: string }) {
    try {
      console.log(reg_no);
      console.log('reg');
      const user = await this.userService.findUserByRegNo(reg_no.toLowerCase());
      console.log(reg_no);
      console.log(user);

      if (user && user.status === REGSTATUS.OTP_VERIFIED) {
        throw new BadRequestException('User Already Exist');
      }
      const student = await this.udusService.findOneByRegNo(reg_no);
      console.log(reg_no);
      console.log(student);
      if (!student) {
        throw new NotFoundException(`Student with ${reg_no} does not exist`);
      }

      return student;
    } catch (err) {
      throw new BadRequestException(err);
    }
  }

  @Get()
  findAll() {
    return this.udusService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.udusService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUdusDto: UpdateUdusDto) {
    return this.udusService.update(+id, updateUdusDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.udusService.remove(+id);
  }
}
