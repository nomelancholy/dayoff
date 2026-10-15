import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { EmailService } from '../common/email/email.service';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import {
  validateContactAttachment,
  type ContactAttachment,
} from './contact-upload';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  async submit(dto: CreateInquiryDto, attachment?: ContactAttachment) {
    if (dto.website) return { success: true };
    const to = this.config.get<string>('CONTACT_TO_EMAIL')?.trim();
    if (
      !to ||
      !isEmail(to) ||
      !this.config.get<string>('RESEND_API_KEY')?.trim() ||
      !this.config.get<string>('RESEND_FROM_EMAIL')?.trim()
    ) {
      throw new ServiceUnavailableException(
        '문의 접수 설정을 준비 중입니다. 안내된 이메일로 연락해 주세요.',
      );
    }
    const filename = attachment
      ? validateContactAttachment(attachment)
      : undefined;
    try {
      await this.email.sendContactInquiry({
        to,
        name: dto.name,
        email: dto.email,
        category: dto.category,
        subject: dto.subject,
        message: dto.message,
        attachment:
          attachment && filename
            ? { filename, buffer: attachment.buffer }
            : undefined,
      });
    } catch (error) {
      const reason =
        error instanceof Error
          ? (error.message.match(/^resend request failed \(\d+\)/)?.[0] ??
            error.name)
          : 'UnknownError';
      this.logger.error(`Contact inquiry email delivery failed: ${reason}`);
      throw new ServiceUnavailableException(
        '문의 전송에 실패했습니다. 잠시 후 다시 시도하거나 안내된 이메일로 연락해 주세요.',
      );
    }
    return { success: true };
  }
}
