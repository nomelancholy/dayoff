import {
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContactGuard } from './contact.guard';
import { ContactService } from './contact.service';
import { contactUploadOptions, type ContactAttachment } from './contact-upload';
import { CreateInquiryDto } from './dto/create-inquiry.dto';

@Controller('api/contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post('inquiries')
  @HttpCode(200)
  @UseGuards(ContactGuard)
  @UseInterceptors(FileInterceptor('attachment', contactUploadOptions))
  submit(
    @Body() dto: CreateInquiryDto,
    @UploadedFile() attachment?: ContactAttachment,
  ) {
    return this.contact.submit(dto, attachment);
  }
}
