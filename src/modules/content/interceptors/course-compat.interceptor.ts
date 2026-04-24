import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class CourseCompatInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    if (req.body) {
      this.mapBody(req.body);
    }
    return next.handle();
  }

  private mapBody(obj: any) {
    if (!obj || typeof obj !== 'object') return;

    if (obj.title && !obj.titleAr) {
      obj.titleAr = obj.title;
      obj.titleEn = obj.title;
    }
    if (obj.description && !obj.descriptionAr) obj.descriptionAr = obj.description;
    if (obj.thumbnail && !obj.thumbnailUrl) obj.thumbnailUrl = obj.thumbnail;
    if (obj.duration !== undefined && obj.durationMinutes === undefined)
      obj.durationMinutes = obj.duration;
    if (obj.articleContent !== undefined && !obj.contentAr) obj.contentAr = obj.articleContent;

    if (obj.programId === '') delete obj.programId;
    delete obj.language;
    delete obj.attachments; // from lessons
    delete obj.isPublished;

    if (Array.isArray(obj.sections)) {
      obj.sections.forEach((s: any) => this.mapBody(s));
    }
    if (Array.isArray(obj.lessons)) {
      obj.lessons.forEach((l: any) => this.mapBody(l));
    }
  }
}
