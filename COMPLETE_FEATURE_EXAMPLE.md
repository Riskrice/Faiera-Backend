# 🚀 مثال عملي كامل: تطبيق ميزة جديدة
## Complete Real-World Example: Implementing New Feature

---

## 📝 المتطلبات

**الميزة:** نظام تقييم الكورسات مع التعليقات

### الحالات الاستخدام:
```
1. Student يقيّم كورس (1-5 نجوم)
2. Student يضيف تعليق مكتوب
3. Admin يثبّت تعليقات مهمة
4. Students يشاهدون تقييمات الكورس
5. Teacher يرد على التعليقات
```

### الـ Database Schema:
```sql
-- Review (تقييم)
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  course_id INT REFERENCES courses(id),
  user_id INT REFERENCES users(id),
  rating INT (1-5),
  comment TEXT,
  is_pinned BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  UNIQUE(course_id, user_id)  -- One review per user per course
);

-- Reply (رد)
CREATE TABLE review_replies (
  id SERIAL PRIMARY KEY,
  review_id INT REFERENCES reviews(id),
  author_id INT REFERENCES users(id),
  content TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 1️⃣ Backend Implementation

### Step 1: Entity Definition

**📄 src/modules/reviews/entities/review.entity.ts**
```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'
import { User } from '../../users/entities/user.entity'
import { Course } from '../../content/entities/course.entity'
import { ReviewReply } from './review-reply.entity'

@Entity('reviews')
@Index(['courseId', 'userId'], { unique: true })  // One review per user per course
export class Review {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  courseId: number

  @Column()
  userId: number

  @Column({ type: 'int', default: 5 })
  rating: number  // 1-5

  @Column({ type: 'text', nullable: true })
  comment: string

  @Column({ type: 'boolean', default: false })
  isPinned: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  // Relations
  @ManyToOne(() => Course, (course) => course.reviews, { onDelete: 'CASCADE' })
  course: Course

  @ManyToOne(() => User, (user) => user.reviews)
  user: User

  @OneToMany(() => ReviewReply, (reply) => reply.review, { cascade: true })
  replies: ReviewReply[]
}
```

**📄 src/modules/reviews/entities/review-reply.entity.ts**
```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm'
import { Review } from './review.entity'
import { User } from '../../users/entities/user.entity'

@Entity('review_replies')
export class ReviewReply {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  reviewId: number

  @Column()
  authorId: number

  @Column({ type: 'text' })
  content: string

  @CreateDateColumn()
  createdAt: Date

  // Relations
  @ManyToOne(() => Review, (review) => review.replies, { onDelete: 'CASCADE' })
  review: Review

  @ManyToOne(() => User)
  author: User
}
```

---

### Step 2: DTOs

**📄 src/modules/reviews/dto/create-review.dto.ts**
```typescript
import { IsInt, Min, Max, IsString, IsOptional, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateReviewDto {
  @ApiProperty({ description: 'Course ID', example: 1 })
  @IsInt()
  courseId: number

  @ApiProperty({ description: 'Rating from 1-5', example: 4 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number

  @ApiProperty({ description: 'Review comment', example: 'Great course!' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string
}

export class UpdateReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string
}

export class ReviewResponseDto {
  id: number
  courseId: number
  userId: number
  rating: number
  comment: string
  isPinned: boolean
  user: {
    id: number
    name: string
    avatar: string
  }
  replies: ReviewReplyResponseDto[]
  createdAt: Date
  updatedAt: Date
}

export class ReviewReplyResponseDto {
  id: number
  authorId: number
  content: string
  author: {
    id: number
    name: string
    avatar: string
  }
  createdAt: Date
}
```

---

### Step 3: Service

**📄 src/modules/reviews/reviews.service.ts**
```typescript
import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Review } from './entities/review.entity'
import { ReviewReply } from './entities/review-reply.entity'
import { CreateReviewDto, UpdateReviewDto } from './dto'
import { CacheService } from '../../redis/cache.service'

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private reviewRepo: Repository<Review>,
    @InjectRepository(ReviewReply) private replyRepo: Repository<ReviewReply>,
    private cacheService: CacheService,
  ) {}

  // Create review
  async create(userId: number, dto: CreateReviewDto): Promise<Review> {
    // Check if review already exists
    const existingReview = await this.reviewRepo.findOne({
      where: { courseId: dto.courseId, userId },
    })

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this course')
    }

    // Create review
    const review = this.reviewRepo.create({
      ...dto,
      userId,
    })

    const savedReview = await this.reviewRepo.save(review)

    // Invalidate cache
    await this.invalidateCourseReviewsCache(dto.courseId)

    return savedReview
  }

  // Update review
  async update(userId: number, reviewId: number, dto: UpdateReviewDto): Promise<Review> {
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } })

    if (!review) {
      throw new NotFoundException('Review not found')
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only update your own reviews')
    }

    Object.assign(review, dto)
    const updated = await this.reviewRepo.save(review)

    // Invalidate cache
    await this.invalidateCourseReviewsCache(review.courseId)

    return updated
  }

  // Delete review
  async delete(userId: number, reviewId: number): Promise<void> {
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } })

    if (!review) {
      throw new NotFoundException('Review not found')
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only delete your own reviews')
    }

    await this.reviewRepo.remove(review)

    // Invalidate cache
    await this.invalidateCourseReviewsCache(review.courseId)
  }

  // Get course reviews (with pagination + cache)
  async getCourseReviews(
    courseId: number,
    page = 1,
    limit = 10
  ) {
    // Try to get from cache
    const cacheKey = `course:${courseId}:reviews:${page}`
    const cached = await this.cacheService.get(cacheKey)

    if (cached) {
      return JSON.parse(cached)
    }

    // Query database
    const [reviews, total] = await this.reviewRepo.findAndCount({
      where: { courseId },
      relations: ['user', 'replies', 'replies.author'],
      order: { isPinned: 'DESC', createdAt: 'DESC' }, // Pinned first
      take: limit,
      skip: (page - 1) * limit,
    })

    const result = {
      data: reviews,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    }

    // Cache for 1 hour
    await this.cacheService.set(cacheKey, JSON.stringify(result), 3600)

    return result
  }

  // Get course statistics
  async getCourseStats(courseId: number) {
    const cacheKey = `course:${courseId}:stats`
    const cached = await this.cacheService.get(cacheKey)

    if (cached) {
      return JSON.parse(cached)
    }

    const results = await this.reviewRepo
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'averageRating')
      .addSelect('COUNT(r.id)', 'totalReviews')
      .where('r.courseId = :courseId', { courseId })
      .getRawOne()

    const stats = {
      averageRating: parseFloat(results.averageRating) || 0,
      totalReviews: parseInt(results.totalReviews) || 0,
    }

    // Cache for 1 hour
    await this.cacheService.set(cacheKey, JSON.stringify(stats), 3600)

    return stats
  }

  // Pin review (admin/teacher only)
  async pinReview(reviewId: number, userId: number): Promise<Review> {
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } })

    if (!review) {
      throw new NotFoundException('Review not found')
    }

    // Check if user is teacher/admin of this course
    // (assume this is checked in controller via guard)

    review.isPinned = !review.isPinned
    const updated = await this.reviewRepo.save(review)

    // Invalidate cache
    await this.invalidateCourseReviewsCache(review.courseId)

    return updated
  }

  // Add reply to review
  async addReply(reviewId: number, userId: number, content: string): Promise<ReviewReply> {
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } })

    if (!review) {
      throw new NotFoundException('Review not found')
    }

    const reply = this.replyRepo.create({
      reviewId,
      authorId: userId,
      content,
    })

    const saved = await this.replyRepo.save(reply)

    // Invalidate all review caches for this course
    await this.invalidateCourseReviewsCache(review.courseId)

    return saved
  }

  // Helper: invalidate cache
  private async invalidateCourseReviewsCache(courseId: number): Promise<void> {
    // Clear all pages for this course
    for (let page = 1; page <= 100; page++) {
      const cacheKey = `course:${courseId}:reviews:${page}`
      await this.cacheService.del(cacheKey)
    }
    // Clear stats cache
    await this.cacheService.del(`course:${courseId}:stats`)
  }
}
```

---

### Step 4: Controller

**📄 src/modules/reviews/reviews.controller.ts**
```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { JwtGuard } from '../../auth/guards/jwt.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Role } from '../../auth/decorators/role.decorator'
import { ReviewsService } from './reviews.service'
import { CreateReviewDto, UpdateReviewDto } from './dto'

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // Create review
  @Post()
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new review' })
  async create(@Req() req, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(req.user.id, dto)
  }

  // Update review
  @Patch(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update your review' })
  async update(@Req() req, @Param('id') reviewId: number, @Body() dto: UpdateReviewDto) {
    return this.reviewsService.update(req.user.id, reviewId, dto)
  }

  // Delete review
  @Delete(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete your review' })
  async delete(@Req() req, @Param('id') reviewId: number) {
    await this.reviewsService.delete(req.user.id, reviewId)
    return { message: 'Review deleted' }
  }

  // Get course reviews
  @Get('course/:courseId')
  @ApiOperation({ summary: 'Get reviews for a course' })
  async getCourseReviews(
    @Param('courseId') courseId: number,
    @Query('page') page = 1,
    @Query('limit') limit = 10
  ) {
    return this.reviewsService.getCourseReviews(courseId, page, limit)
  }

  // Get course statistics
  @Get('course/:courseId/stats')
  @ApiOperation({ summary: 'Get course rating statistics' })
  async getCourseStats(@Param('courseId') courseId: number) {
    return this.reviewsService.getCourseStats(courseId)
  }

  // Pin review (admin/teacher only)
  @Patch(':id/pin')
  @UseGuards(JwtGuard, RolesGuard)
  @Role('ADMIN', 'TEACHER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pin/unpin a review (admin only)' })
  async pinReview(@Req() req, @Param('id') reviewId: number) {
    return this.reviewsService.pinReview(reviewId, req.user.id)
  }

  // Add reply to review
  @Post(':id/replies')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reply to a review' })
  async addReply(
    @Req() req,
    @Param('id') reviewId: number,
    @Body('content') content: string
  ) {
    return this.reviewsService.addReply(reviewId, req.user.id, content)
  }
}
```

---

### Step 5: Module

**📄 src/modules/reviews/reviews.module.ts**
```typescript
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Review } from './entities/review.entity'
import { ReviewReply } from './entities/review-reply.entity'
import { ReviewsService } from './reviews.service'
import { ReviewsController } from './reviews.controller'
import { RedisModule } from '../../redis/redis.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, ReviewReply]),
    RedisModule,
  ],
  providers: [ReviewsService],
  controllers: [ReviewsController],
  exports: [ReviewsService],
})
export class ReviewsModule {}
```

---

### Step 6: Updating Main App Module

**📄 src/app.module.ts** (تحديث)
```typescript
import { Module } from '@nestjs/common'
import { ReviewsModule } from './modules/reviews/reviews.module'  // أضفِ هذا

// ... other imports

@Module({
  imports: [
    // ... existing modules
    ReviewsModule,  // أضفِ هذا
  ],
})
export class AppModule {}
```

---

## 2️⃣ Frontend Implementation

### Step 1: Review Component

**📄 src/components/ReviewForm.tsx**
```typescript
import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'

interface ReviewFormProps {
  courseId: number
  onSuccess?: () => void
}

export const ReviewForm: React.FC<ReviewFormProps> = ({ courseId, onSuccess }) => {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (data) => api.post('/reviews', data),
    onSuccess: () => {
      setRating(5)
      setComment('')
      onSuccess?.()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (comment.length > 1000) {
      setError('تعليقك طويل جداً (أقصى 1000 حرف)')
      return
    }

    mutation.mutate({
      courseId,
      rating,
      comment: comment || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
      <div>
        <label className="block text-sm font-medium mb-2">
          تقييموا هذا الكورس:
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`text-3xl ${
                star <= rating ? 'text-yellow-400' : 'text-gray-300'
              }`}
              aria-label={`${star} نجوم`}
            >
              ⭐
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="comment" className="block text-sm font-medium mb-2">
          أضيفوا تعليقاً (اختياري):
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="مثلاً: شرح رائع وسهل الفهم..."
          maxLength={1000}
          className="w-full border rounded-lg p-2"
          rows={4}
        />
        <p className="text-xs text-gray-500 mt-1">
          {comment.length}/1000
        </p>
      </div>

      {error && (
        <p className="text-red-500 text-sm" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
        aria-label="إرسال التقييم"
      >
        {mutation.isPending ? 'جاري الإرسال...' : 'إرسال التقييم'}
      </button>
    </form>
  )
}
```

---

### Step 2: Reviews List Component

**📄 src/components/ReviewsList.tsx**
```typescript
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'

interface ReviewsListProps {
  courseId: number
}

export const ReviewsList: React.FC<ReviewsListProps> = ({ courseId }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reviews', courseId],
    queryFn: () => api.get(`/reviews/course/${courseId}`),
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const { data: stats } = useQuery({
    queryKey: ['courseStats', courseId],
    queryFn: () => api.get(`/reviews/course/${courseId}/stats`),
  })

  if (isLoading) return <div>جاري التحميل...</div>
  if (error) return <div>حدث خطأ في تحميل التقييمات</div>

  const { averageRating, totalReviews } = stats || {}

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-3xl font-bold">
              {averageRating?.toFixed(1) || 'N/A'}
            </div>
            <div className="text-yellow-400">
              {'⭐'.repeat(Math.round(averageRating || 0))}
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600">
              بناءً على {totalReviews || 0} تقييم
            </p>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-3">
        {data?.data?.map((review) => (
          <div key={review.id} className="p-4 border rounded-lg">
            {/* Pinned badge */}
            {review.isPinned && (
              <div className="mb-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded inline-block">
                📌 تقييم مهم
              </div>
            )}

            {/* User info */}
            <div className="flex items-center gap-2 mb-2">
              <img
                src={review.user.avatar}
                alt={review.user.name}
                className="w-8 h-8 rounded-full"
              />
              <div>
                <p className="font-medium">{review.user.name}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(review.createdAt)}
                </p>
              </div>
            </div>

            {/* Rating */}
            <div className="text-yellow-400 mb-2">
              {'⭐'.repeat(review.rating)}
            </div>

            {/* Comment */}
            {review.comment && (
              <p className="text-gray-700 mb-3">{review.comment}</p>
            )}

            {/* Replies */}
            {review.replies?.length > 0 && (
              <div className="mt-3 pl-4 border-l-2 border-gray-300 space-y-2">
                {review.replies.map((reply) => (
                  <div key={reply.id}>
                    <p className="font-medium text-sm">
                      {reply.author.name} (المعلم)
                    </p>
                    <p className="text-sm text-gray-600">{reply.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 3️⃣ Tests

### Backend Test

**📄 src/modules/reviews/reviews.service.spec.ts**
```typescript
import { Test, TestingModule } from '@nestjs/testing'
import { ReviewsService } from './reviews.service'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Review } from './entities/review.entity'
import { BadRequestException, ForbiddenException } from '@nestjs/common'

describe('ReviewsService', () => {
  let service: ReviewsService
  let mockReviewRepo
  let mockCacheService

  beforeEach(async () => {
    mockReviewRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
    }

    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(true),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: getRepositoryToken(Review),
          useValue: mockReviewRepo,
        },
        {
          provide: 'CacheService',
          useValue: mockCacheService,
        },
      ],
    }).compile()

    service = module.get(ReviewsService)
  })

  it('should create a review', async () => {
    mockReviewRepo.findOne.mockResolvedValue(null)
    mockReviewRepo.create.mockReturnValue({ id: 1 })
    mockReviewRepo.save.mockResolvedValue({ id: 1, rating: 5 })

    const result = await service.create(1, { courseId: 1, rating: 5 })

    expect(result).toEqual({ id: 1, rating: 5 })
    expect(mockReviewRepo.findOne).toHaveBeenCalled()
  })

  it('should throw if review already exists', async () => {
    mockReviewRepo.findOne.mockResolvedValue({ id: 1 })

    await expect(service.create(1, { courseId: 1, rating: 5 })).rejects.toThrow(
      BadRequestException
    )
  })

  it('should not allow user to update other user reviews', async () => {
    mockReviewRepo.findOne.mockResolvedValue({ userId: 2 })

    await expect(
      service.update(1, 1, { rating: 3 })
    ).rejects.toThrow(ForbiddenException)
  })
})
```

---

## 4️⃣ Database Migration

**📄 src/database/migrations/CreateReviewsTable.ts**
```typescript
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'

export class CreateReviewsTable1704067200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'reviews',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'courseId',
            type: 'integer',
          },
          {
            name: 'userId',
            type: 'integer',
          },
          {
            name: 'rating',
            type: 'integer',
            default: 5,
          },
          {
            name: 'comment',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isPinned',
            type: 'boolean',
            default: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['courseId'],
            referencedTableName: 'courses',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['userId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      })
    )

    // Unique index for one review per user per course
    await queryRunner.createIndex(
      'reviews',
      new TableIndex({
        columnNames: ['courseId', 'userId'],
        isUnique: true,
      })
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('reviews')
  }
}
```

---

## 5️⃣ API Endpoints Reference

```
✅ Implemented:

POST /reviews
  Create review
  Auth: Required (Student, Teacher, Admin)
  Body: { courseId, rating (1-5), comment? }

PATCH /reviews/:id
  Update own review
  Auth: Required
  Body: { rating?, comment? }

DELETE /reviews/:id
  Delete own review
  Auth: Required

GET /reviews/course/:courseId
  Get reviews for course
  Auth: Not required
  Params: page=1, limit=10

GET /reviews/course/:courseId/stats
  Get statistics
  Auth: Not required

PATCH /reviews/:id/pin
  Pin review (admin/teacher only)
  Auth: Required (ADMIN, TEACHER)

POST /reviews/:id/replies
  Reply to review
  Auth: Required
  Body: { content }
```

---

## 6️⃣ Deployment Steps

```bash
# 1. Create migration
npm run typeorm migration:create CreateReviewsTable

# 2. Run migration locally
npm run typeorm migration:run

# 3. Test locally
npm run test

# 4. Build
npm run build

# 5. Push to GitHub
git add src/modules/reviews
git add src/database/migrations
git commit -m "feat: add course review system"
git push origin feature/reviews

# 6. Create PR, get review, merge

# 7. Deploy to production
npm run typeorm migration:run -- --config ormconfig.prod.js
npm run build
docker build -t faiera:latest .
docker push faiera:latest

# 8. Update service on production
kubectl rollout restart deployment/faiera-api
```

---

## 📊 Performance Monitoring

```bash
# Monitor API endpoint
curl -w "Time: %{time_total}s\n" https://api.faiera.com/reviews/course/1

# Expected response time: < 200ms (cached), < 500ms (without cache)

# Check Redis cache effectiveness
KEYS "course:*:reviews:*" | wc -l
# Should see ~100+ cached queries
```

---

**الآن لديك نظام كامل**:
✅ Database schema
✅ Backend API
✅ Frontend components
✅ Tests
✅ Migrations
✅ Deployment steps

جاهز للإنتاج! 🚀
