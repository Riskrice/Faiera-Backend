import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { QuestionCategoriesService } from '../services/question-categories.service';
import { CreateQuestionCategoryDto, UpdateQuestionCategoryDto } from '../dto/question-category.dto';
import { JwtAuthGuard, CurrentUser, JwtPayload } from '../../auth';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';

@Controller('question-categories')
@UseGuards(JwtAuthGuard)
export class QuestionCategoriesController {
  constructor(private readonly categoriesService: QuestionCategoriesService) {}

  @Post()
  @RequirePermissions({ action: 'manage', resource: 'questions' })
  create(
    @Body() createDto: CreateQuestionCategoryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.categoriesService.create(createDto, user.sub);
  }

  @Get()
  @RequirePermissions({ action: 'view', resource: 'questions' })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get('tree')
  @RequirePermissions({ action: 'view', resource: 'questions' })
  getTree() {
    return this.categoriesService.getTree();
  }

  @Get(':id')
  @RequirePermissions({ action: 'view', resource: 'questions' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions({ action: 'manage', resource: 'questions' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateQuestionCategoryDto,
  ) {
    return this.categoriesService.update(id, updateDto);
  }

  @Delete(':id')
  @RequirePermissions({ action: 'manage', resource: 'questions' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.delete(id);
  }
}
