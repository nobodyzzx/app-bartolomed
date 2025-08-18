import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { MedicalRecordsService, MedicalRecordFilters, PaginationOptions } from './medical-records.service';
import {
  CreateMedicalRecordDto,
  UpdateMedicalRecordDto,
  CreateConsentFormDto,
  UpdateConsentFormDto,
  UploadConsentDocumentDto,
} from './dto';
import { ConsentStatus } from './entities';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';

@Controller('medical-records')
@Auth()
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  // Medical Records Endpoints
  @Post()
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  create(@Body() createMedicalRecordDto: CreateMedicalRecordDto) {
    return this.medicalRecordsService.create(createMedicalRecordDto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('isEmergency') isEmergency?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: MedicalRecordFilters = {
      search,
      type,
      status,
      patientId,
      doctorId,
      startDate,
      endDate,
      isEmergency: isEmergency ? isEmergency === 'true' : undefined,
    };

    const pagination: PaginationOptions = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    };

    return this.medicalRecordsService.findAll(filters, pagination);
  }

  @Get('stats')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  getStats() {
    return this.medicalRecordsService.getStats();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicalRecordsService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateMedicalRecordDto: UpdateMedicalRecordDto) {
    return this.medicalRecordsService.update(id, updateMedicalRecordDto);
  }

  @Delete(':id')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicalRecordsService.remove(id);
  }

  // Consent Forms Endpoints
  @Post('consent-forms')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  createConsentForm(@Body() createConsentFormDto: CreateConsentFormDto) {
    return this.medicalRecordsService.createConsentForm(createConsentFormDto);
  }

  @Get('consent-forms')
  findAllConsentForms(
    @Query('patientId') patientId?: string,
    @Query('medicalRecordId') medicalRecordId?: string,
    @Query('status') status?: ConsentStatus,
  ) {
    return this.medicalRecordsService.findAllConsentForms({
      patientId,
      medicalRecordId,
      status,
    });
  }

  @Get('consent-forms/:id')
  findOneConsentForm(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicalRecordsService.findOneConsentForm(id);
  }

  @Patch('consent-forms/:id')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  updateConsentForm(@Param('id', ParseUUIDPipe) id: string, @Body() updateConsentFormDto: UpdateConsentFormDto) {
    return this.medicalRecordsService.updateConsentForm(id, updateConsentFormDto);
  }

  @Post('consent-forms/:id/upload')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN, ValidRoles.USER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/consent-forms',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(pdf|jpg|jpeg|png)$/)) {
          return cb(new Error('Only PDF and image files are allowed!'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  uploadConsentDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: any,
    @Body() uploadData: UploadConsentDocumentDto,
  ) {
    return this.medicalRecordsService.uploadConsentDocument(id, file, uploadData);
  }

  @Delete('consent-forms/:id')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeConsentForm(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicalRecordsService.removeConsentForm(id);
  }

  @Get(':id/consent-forms')
  getConsentFormsByMedicalRecord(@Param('id', ParseUUIDPipe) medicalRecordId: string) {
    return this.medicalRecordsService.getConsentFormsByMedicalRecord(medicalRecordId);
  }
}
