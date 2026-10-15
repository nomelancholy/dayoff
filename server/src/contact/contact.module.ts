import { Module } from '@nestjs/common';
import { EmailModule } from '../common/email/email.module';
import { ContactController } from './contact.controller';
import { ContactGuard } from './contact.guard';
import { ContactService } from './contact.service';

@Module({
  imports: [EmailModule],
  controllers: [ContactController],
  providers: [ContactService, ContactGuard],
})
export class ContactModule {}
