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
import { InstitutionService } from './institution.service';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { Public } from 'decorators/public.decorator';
import { UsersService } from 'src/users/users.service';
import { REGSTATUS } from 'src/users/types';
import { Institution } from './institution.schema';

@Controller('institution')
@Public()
export class InstitutionController {
  constructor(
    private readonly institutionService: InstitutionService,
    private readonly userService: UsersService,
  ) {}

  @Post('/create')
  async createInstitution(@Body() institute: Partial<Institution>) {
    return this.institutionService.create(institute);
  }

  // @Post()
  // async create(@Body() { reg_no }: { reg_no: string }) {
  //   try {
  //     console.log(reg_no);
  //     console.log('reg');
  //     const user = await this.userService.findUserByRegNo(reg_no.toLowerCase());
  //     console.log(reg_no);
  //     console.log(user);

  //     if (user && user.status === REGSTATUS.OTP_VERIFIED) {
  //       throw new BadRequestException('User Already Exist');
  //     }
  //     const student = await this.institutionService.findOneByRegNo(reg_no);
  //     console.log(reg_no);
  //     console.log(student);
  //     if (!student) {
  //       throw new NotFoundException(`Student with ${reg_no} does not exist`);
  //     }

  //     return student;
  //   } catch (err) {
  //     throw new BadRequestException(err);
  //   }
  // }

  @Get()
  findAll() {
    return this.institutionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.institutionService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateInstitutionDto: UpdateInstitutionDto,
  ) {
    return this.institutionService.update(+id, updateInstitutionDto);
  }

  @Delete()
  remove(@Body() body: { id: string }) {
    return this.institutionService.remove(body.id);
  }
}
