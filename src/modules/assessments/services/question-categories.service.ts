import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionCategory } from '../entities/question-category.entity';
import { CreateQuestionCategoryDto, UpdateQuestionCategoryDto } from '../dto/question-category.dto';

@Injectable()
export class QuestionCategoriesService {
  private readonly logger = new Logger(QuestionCategoriesService.name);

  constructor(
    @InjectRepository(QuestionCategory)
    private readonly categoryRepository: Repository<QuestionCategory>,
  ) {}

  async create(dto: CreateQuestionCategoryDto, createdBy: string): Promise<QuestionCategory> {
    const category = this.categoryRepository.create({
      ...dto,
      createdBy,
    });
    
    await this.categoryRepository.save(category);
    this.logger.log(`Question Category created: ${category.id}`);
    return category;
  }

  async findAll(): Promise<QuestionCategory[]> {
    return this.categoryRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getTree(): Promise<QuestionCategory[]> {
    const allCategories = await this.categoryRepository
      .createQueryBuilder('category')
      .loadRelationCountAndMap('category.questionCount', 'category.questions')
      .orderBy('category.nameAr', 'ASC')
      .getMany();

    const categoryMap = new Map<string, QuestionCategory>();
    const tree: QuestionCategory[] = [];

    // First pass: map all categories and initialize children array
    allCategories.forEach(cat => {
      cat.children = [];
      categoryMap.set(cat.id, cat);
    });

    // Second pass: build tree
    allCategories.forEach(cat => {
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId)!.children.push(cat);
      } else {
        tree.push(cat);
      }
    });

    return tree;
  }

  async findById(id: string): Promise<QuestionCategory> {
    const category = await this.categoryRepository.findOne({ 
      where: { id },
      relations: ['parent', 'children']
    });
    
    if (!category) {
      throw new NotFoundException('Question category not found');
    }
    
    return category;
  }

  async update(id: string, dto: UpdateQuestionCategoryDto): Promise<QuestionCategory> {
    const category = await this.findById(id);
    
    // Prevent setting self as parent
    if (dto.parentId && dto.parentId === id) {
      throw new NotFoundException('Category cannot be its own parent');
    }

    Object.assign(category, dto);
    await this.categoryRepository.save(category);
    
    this.logger.log(`Question Category updated: ${id}`);
    return category;
  }

  async delete(id: string): Promise<void> {
    const category = await this.findById(id);
    await this.categoryRepository.remove(category);
    this.logger.log(`Question Category deleted: ${id}`);
  }
}
