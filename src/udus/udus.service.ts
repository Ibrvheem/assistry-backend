import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUdusDto } from './dto/create-udus.dto';
import { UpdateUdusDto } from './dto/update-udus.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UDUS } from './udus.schema';
import { REGSTATUS } from 'src/users/types';
import { UsersService } from 'src/users/users.service';
import { SUCCESS } from 'constants/CustomResponses';

@Injectable()
export class UdusService {
  constructor(
    @InjectModel('UDUS') private readonly udusModel: Model<UDUS>,
    private readonly usersService: UsersService,
  ) {}

  create(createUdusDto: CreateUdusDto) {
    // return 'This action adds a new udus';
    const newStudent = new this.udusModel(createUdusDto);
    return newStudent.save();
  }

  findAll() {
    return `This action returns all udus`;
  }
  async findOneByRegNo(reg_no: string) {
    const student = await this.udusModel
      .findOne({ reg_no: reg_no.toLowerCase() })
      .exec();
    if (!student) {
      throw new NotFoundException(`Student with reg no: ${reg_no} not found`);
    }

    const existingUser = await this.usersService.getUserByRegNo(reg_no);
    if (!existingUser) {
      const newUser = await this.usersService.createUser({
        email: student.email,
        first_name: student.first_name,
        last_name: student.last_name,
        reg_no: student.reg_no,
        phone_no: student.phone_no,
        profile_picture: undefined,
        password: undefined,
        otp: undefined,
        status: REGSTATUS.REG_FOUND,
        created_at: new Date(),
        updated_at: undefined,
        bio: undefined,
        department: undefined,
        level: undefined,
      });
      return newUser;
    }

    if (existingUser.status === REGSTATUS.COMPLETED) {
      throw new ForbiddenException(
        'User with this reg_no has an active account',
      );
    }

    await this.usersService.updateUser(
      {
        email: student.email,
        first_name: student.first_name,
        last_name: student.last_name,
        reg_no: student.reg_no,
        phone_no: student.phone_no,
        updated_at: new Date(),
      },
      existingUser.id,
    );
    return student;
  }

  findOne(id: number) {
    return `This action returns a #${id} udus`;
  }
  update(id: number, updateUdusDto: UpdateUdusDto) {
    return `This action updates a #${id} udus`;
  }

  remove(id: number) {
    return `This action removes a #${id} udus`;
  }
}
