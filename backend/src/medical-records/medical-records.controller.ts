import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Auth, AuthClinic, GetUser } from '../auth/decorators';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
import {
  CreateConsentFormDto,
  CreateMedicalRecordDto,
  UpdateConsentFormDto,
  UpdateMedicalRecordDto,
  UploadConsentDocumentDto,
} from './dto';
import { ConsentStatus } from './entities';
import { MedicalRecordFilters, MedicalRecordsService, PaginationOptions } from './medical-records.service';
import { MedicalRecordsPdfService } from './services/medical-records-pdf.service';
import { ConsentPdfDto, SummaryPdfDto } from './dto/pdf.dto';

@Controller('medical-records')
@AuthClinic()
@RequirePermissions(Permission.RecordsRead, Permission.RecordsWrite, Permission.RecordsWriteVitals)
export class MedicalRecordsController {
  constructor(
    private readonly medicalRecordsService: MedicalRecordsService,
    private readonly pdfService: MedicalRecordsPdfService,
  ) {}

  // Medical Records Endpoints
  @Post()
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  create(@Body() createMedicalRecordDto: CreateMedicalRecordDto, @GetUser() user: User, @Req() req: Request) {
    const clinicId = resolveClinicId(req)!;
    return this.medicalRecordsService.create(createMedicalRecordDto, user, clinicId);
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
    @Req() req?: Request,
  ) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    const filters: MedicalRecordFilters = {
      search,
      type,
      status,
      patientId,
      doctorId,
      clinicId,
      startDate,
      endDate,
      isEmergency: isEmergency ? isEmergency === 'true' : undefined,
    };

    const pagination: PaginationOptions = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    };

    return this.medicalRecordsService.findAll(filters, pagination, clinicId);
  }

  @Get('stats')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  getStats(@Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.medicalRecordsService.getStats(clinicId);
  }

  @Get('patient/:patientId')
  getMedicalRecordsByPatient(@Param('patientId', ParseUUIDPipe) patientId: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.medicalRecordsService.getMedicalRecordsByPatient(patientId, clinicId);
  }

  @Get('doctor/:doctorId')
  getMedicalRecordsByDoctor(@Param('doctorId', ParseUUIDPipe) doctorId: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.medicalRecordsService.getMedicalRecordsByDoctor(doctorId, clinicId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.medicalRecordsService.findOne(id, clinicId);
  }

  @Patch(':id')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMedicalRecordDto: UpdateMedicalRecordDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const clinicId = resolveClinicId(req);
    return this.medicalRecordsService.update(id, updateMedicalRecordDto, user, clinicId);
  }

  @Delete(':id')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.medicalRecordsService.remove(id, clinicId);
  }

  // PDF Generation Endpoints
  @Post('pdf/consent')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  async generateConsentPdf(@Body() dto: ConsentPdfDto, @Res() res: Response): Promise<void> {
    const buffer = await this.pdfService.generateConsentPdf(dto);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="consentimiento.pdf"');
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Post('pdf/summary')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  async generateSummaryPdf(@Body() dto: SummaryPdfDto, @Res() res: Response): Promise<void> {
    const buffer = await this.pdfService.generateSummaryPdf(dto);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="expediente-medico.pdf"');
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  // Consent Forms Endpoints
  @Post('consent-forms')
  @Auth(ValidRoles.DOCTOR, ValidRoles.ADMIN)
  createConsentForm(@Body() createConsentFormDto: CreateConsentFormDto, @Req() req: Request) {
    const clinicId = resolveClinicId(req)!;
    return this.medicalRecordsService.createConsentForm(createConsentFormDto, clinicId);
  }

  @Get('consent-forms')
  findAllConsentForms(
    @Query('patientId') patientId?: string,
    @Query('medicalRecordId') medicalRecordId?: string,
    @Query('status') status?: ConsentStatus,
    @Req() req?: Request,
  ) {
    const clinicId = req ? resolveClinicId(req) : undefined;
    return this.medicalRecordsService.findAllConsentForms({
      patientId,
      medicalRecordId,
      status,
      clinicId,
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
