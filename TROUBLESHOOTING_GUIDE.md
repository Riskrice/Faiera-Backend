# 🐛 Common Issues & Solutions
## مشاكل شائعة وحلولها

---

## 🔴 المشاكل بسبب الـ Configuration

### Problem 1: "Cannot find module 'typeorm'"

**الأعراض:**
```
Error: Cannot find module 'typeorm'
```

**الحل:**
```bash
# 1. تحقق من package.json
grep typeorm package.json

# 2. إذا لم تجده، ثبّته
npm install typeorm

# 3. إذا كان مثبت، امسح node_modules
rm -rf node_modules package-lock.json

# 4. أعد التثبيت
npm install

# 5. تحقق من global cache
npm cache clean --force
npm install
```

**الجذر:**
- الملفات المُسحوبة من Git بدون node_modules
- مشاكل في npm cache
- نسخة Node.js قديمة (استخدم 18+)

---

### Problem 2: ".env file not found"

**الأعراض:**
```
Error: ENOENT: no such file or directory, open '.env'
```

**الحل:**
```bash
# 1. تحقق من وجود ملف .env
ls -la | grep .env

# 2. إنشاء ملف .env من .env.example
cp .env.example .env

# 3. ملء البيانات
nano .env
# أو استخدم VSCode:
code .env

# 3. أعد تشغيل التطبيق
npm run dev
```

**الملفات المطلوبة:**
```
.env (local development)
.env.production (production)
.env.test (testing)
```

**نموذج .env:**
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=faiera_db
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Frontend
FRONTEND_URL=http://localhost:3000

# API
API_PORT=3001
NODE_ENV=development
```

---

### Problem 3: "Database connection refused"

**الأعراض:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**الحل:**
```bash
# 1. تحقق من Docker
docker ps | grep postgres

# 2. إذا لم يكن موجود، شغّل Docker compose
docker compose up -d

# 3. تحقق من الاتصال
docker logs <container_id>

# 4. أعد محاولة الاتصال
psql -h localhost -U postgres -d postgres

# 5. إذا لم يعمل، أعد تشغيل
docker compose down
docker compose up -d
sleep 5  # انتظر ليبدأ الـ database
npm run dev
```

**التحقق من الاتصال:**
```bash
# من داخل Docker container
docker exec <postgres_container> psql -U postgres -c "SELECT 1"

# إذا كان موجود:
# (1 row)
```

---

## 🟠 مشاكل الـ Performance

### Problem 4: "Application startup takes > 5 seconds"

**الأعراض:**
```
App listening on port 3001 (4.2s elapsed)
```

**الحل (من الأسرع للأبطأ):**

#### 1. تحديث Node.js
```bash
# تحقق من النسخة الحالية
node --version

# استخدم Node 18 أو 20 (الأسرع)
nvm install 18
nvm use 18
```

#### 2. تعطيل الـ Hot Module Reloading
```typescript
// في development, HOT reload بطيء بعض الأحيان
// في package.json:
"dev": "nest start --watch",  // جيد
// بدلاً من:
"dev": "nest start --watch --exec 'npm run webpack'",  // بطيء
```

#### 3. Lazy Load الـ Modules
```typescript
// src/app.module.ts
@Module({
  imports: [
    // Lazy load heavy modules
    {
      module: DatabaseModule,
      useFactory: async () => {
        if (process.env.SKIP_DB === 'true') {
          return {};
        }
        return await DatabaseModule.forRoot();
      },
    },
    // ... rest of modules
  ],
})
export class AppModule {}
```

#### 4. Pre-compile TypeScript
```bash
# بدلاً من تجميع TypeScript في كل مرة
npm run build  # مسبقاً

# ثم شغّل الـ compiled version
npm run start
```

---

### Problem 5: "API response takes > 1 second"

**الأعراض:**
```
GET /api/courses → 1200ms
```

**التشخيص:**
```bash
# 1. استخدم curl مع timing
curl -w "Time: %{time_total}s\n" http://localhost:3001/api/courses

# 2. استخدم آلة حاسبة النسبة
# 1. Network latency: 50ms
# 2. Database query: 800ms ← المشكلة!
# 3. Processing: 100ms
# 4. Serialization: 50ms
```

**الحل - Query Optimization:**

```typescript
// ❌ قبل (N+1 problem)
const courses = await this.courseRepo.find()
// Database hits: 1 (courses) + N (for each course's instructor)

// ✅ بعد (eager loading)
const courses = await this.courseRepo.find({
  relations: ['instructor', 'modules'],  // Load related data
  take: 100,
  skip: 0,
})
```

**الحل - Caching:**
```typescript
// ✅ مع Redis caching
@Get('courses')
@CacheKey('courses_list')
@CacheTTL(600)  // Cache for 10 minutes
async getCourses() {
  return await this.courseService.list()
}
```

---

### Problem 6: "Frontend becomes unresponsive"

**الأعراض:**
```
- Buttons take 500ms to respond
- Typing in input has lag
- Scrolling is janky
```

**الحل - Check FID (First Input Delay):**

```typescript
// قياس FID:
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`FID: ${entry.processingDuration}ms`)
  }
})
observer.observe({ entryTypes: ['first-input'] })

// مجموع الـ delay:
// FID = event processing time (ليس الـ network delay)
```

**التحقق من الـ Long Tasks:**
```typescript
// في Chrome DevTools Console:
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.warn('Long Task:', entry.duration)
  }
})
observer.observe({ entryTypes: ['longtask'] })

// يجب أن تكون < 50ms لـ responsive UI
```

**الحلول:**
1. Break long computations into smaller chunks (Web Workers)
2. Defer non-critical work (requestIdleCallback)
3. Use Event Delegation (قلل عدد listeners)

---

## 🟡 مشاكل الأمان

### Problem 7: "JWT token validation fails"

**الأعراض:**
```
Error: Invalid token signature
Error: Token has expired
```

**الحل:**
```typescript
// 1. تحقق من JWT_SECRET
console.log('JWT Secret:', process.env.JWT_SECRET)

// 2. تأكد من أن الـ secret نفسه في الـ issuer و verifier
// src/auth/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'), // ✅ مشترك
    })
  }
}

// 3. تحقق من Token expiry
const token = jwt.sign(
  { userId: user.id },
  process.env.JWT_SECRET,
  { expiresIn: '15m' }  // ✅ 15 minutes
)

// 4. استخدم refresh token لـ extending session
@Post('refresh')
async refreshToken(@Body('refreshToken') refreshToken: string) {
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
  const newAccessToken = jwt.sign(
    { userId: decoded.userId },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  )
  return { accessToken: newAccessToken }
}
```

---

### Problem 8: "SQL Injection vulnerability"

**الأعراض:**
```typescript
// ❌ خطر جداً!
const query = `SELECT * FROM users WHERE email = '${email}'`
```

**الحل:**
```typescript
// ✅ TypeORM (parameterized queries)
const user = await this.userRepo.findOne({
  where: { email }, // TypeORM handles escaping
})

// ✅ أو استخدم raw query مع parameters
const users = await this.userRepo.query(
  'SELECT * FROM users WHERE email = $1',
  [email]  // Parameters, not string concatenation
)

// ✅ أو Query Builder
const users = await this.userRepo
  .createQueryBuilder('u')
  .where('u.email = :email', { email }) // Named parameters
  .getMany()
```

---

## 🟢 مشاكل قواعد البيانات

### Problem 9: "Migrations fail"

**الأعراض:**
```
Error: migration "AddUserRole1704067200000.ts" failed
```

**الحل:**
```bash
# 1. معرفة أي migration فشلت
npm run typeorm migration:show

# 2. إرجاع آخر migration
npm run typeorm migration:rollback

# 3. أنشئ migration جديدة
npm run typeorm migration:create src/database/migrations/FixUserRole

# 4. عدّل الـ migration file
# src/database/migrations/FixUserRole.ts

# 5. شغّل الـ migrations
npm run typeorm migration:run

# 6. تحقق من النتيجة
npm run typeorm migration:show
```

**مثال على Migration:**
```typescript
// src/database/migrations/AddRoleColumn.ts
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AddRoleColumn1704067200000 implements MigrationInterface {
  name = 'AddRoleColumn1704067200000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'role',
        type: 'varchar',
        default: "'STUDENT'",
      })
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'role')
  }
}
```

---

### Problem 10: "No data in production database"

**الأعراض:**
```
SELECT COUNT(*) FROM courses
// (0 rows)
```

**الحل:**
```bash
# 1. تحقق من environment
echo $NODE_ENV  # يجب أن يكون 'production'

# 2. تحقق من اتصال البيانات
psql production_db_url -c "SELECT 1"

# 3. هل قمت بتشغيل seeders؟
npm run seed

# 4. إذا لم توجد seeders:
npm run typeorm seed:create SeedCourses

# 5. فعّلها
npm run typeorm seed:run
```

**مثال Seeder:**
```typescript
// src/database/seeds/SeedCourses.seed.ts
import { Seeder, SeederFactoryManager } from 'typeorm-extension'
import { DataSource } from 'typeorm'
import { Course } from '../entities/course.entity'

export class SeedCourses implements Seeder {
  async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager
  ): Promise<void> {
    const courseFactory = factoryManager.get(Course)
    await courseFactory.saveMany(10)
  }
}
```

---

## 🔵 مشاكل الـ Testing

### Problem 11: "Tests fail with timeout"

**الأعراض:**
```
Jest did not exit one second after the test run has completed.
Timeout - Async callback was not invoked within the 5000 ms timeout specified by jest.setTimeout
```

**الحل:**
```typescript
// 1. في test file
describe('AuthService', () => {
  // زيادة الـ timeout
  jest.setTimeout(10000)  // 10 seconds

  it('should login user', async () => {
    // ...
  })
})

// 2. أو عند specific test
it('should handle slow operation', async () => {
  expect.assertions(1)  // صرّح بـ expectations
}, 10000)  // timeout

// 3. تأكد من إغلاق الـ connections
afterAll(async () => {
  await dataSource.destroy()
  await redis.disconnect()
})
```

---

### Problem 12: "Mock data not working"

**الأعراض:**
```
Mock resolved value not matching actual response
```

**الحل:**
```typescript
// ❌ خطأ
jest.spyOn(userService, 'findAll').mockReturnValue([...]) // missing await

// ✅ صحيح
jest.spyOn(userService, 'findAll').mockResolvedValue([...])

// اختبار:
it('should return mocked users', async () => {
  const users = await userService.findAll()
  expect(users).toHaveLength(0)
})

// ✅ أو إذا كنت تستخدم Promise:
jest.spyOn(userService, 'findAll').mockImplementation(() => 
  Promise.resolve([{ id: 1, name: 'John' }])
)
```

---

## 💜 مشاكل الـ Deployment

### Problem 13: "Docker build fails"

**الأعراض:**
```
ERROR: manifest not found: unknown
ERROR: failed to solve with frontend dockerfile.v0
```

**الحل:**
```bash
# 1. تحقق من Dockerfile
cat Dockerfile

# 2. اختبر البناء محلياً
docker build -t faiera:latest .

# 3. إذا فشل، استخدم BuildKit
DOCKER_BUILDKIT=1 docker build -t faiera:latest .

# 4. تحقق من الأخطاء
docker build -t faiera:latest . 2>&1 | tail -20
```

**مثال Dockerfile:**
```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --production
EXPOSE 3001
CMD ["node", "dist/main"]
```

---

### Problem 14: "Out of memory in production"

**الأعراض:**
```
Cannot allocate memory
Process killed
```

**الحل:**
```bash
# 1. زيادة الـ Node heap
NODE_OPTIONS=--max-old-space-size=4096 npm start

# 2. في Docker:
docker run -e NODE_OPTIONS=--max-old-space-size=4096 faiera:latest

# 3. إيجاد Memory leak:
npm install --save-dev clinic
clinic doctor -- npm start
# ثم اختبر الـ app
clinic doctor --collect-only -- npm start

# 4. التحقق من الـ Metrics:
ps aux | grep node
# جد PID و استخدم top لمراقبة الذاكرة
top -p <PID>
```

---

### Problem 15: "Container not starting in Kubernetes"

**الأعراض:**
```
CrashLoopBackOff
Pod stuck in pending state
```

**الحل:**
```bash
# 1. تحقق من logs
kubectl logs <pod-name> --previous

# 2. تحقق من الـ events
kubectl describe pod <pod-name>

# 3. تحقق من الـ resources
kubectl top pod <pod-name>

# 4. تجربة locally قبل الـ kube:
docker run -e NODE_ENV=production faiera:latest

# 5. استخدم liveness و readiness probes
apiVersion: v1
kind: Pod
metadata:
  name: faiera
spec:
  containers:
  - name: app
    image: faiera:latest
    ports:
    - containerPort: 3001
    livenessProbe:
      httpGet:
        path: /health/live
        port: 3001
      initialDelaySeconds: 10
    readinessProbe:
      httpGet:
        path: /health/ready
        port: 3001
      initialDelaySeconds: 5
```

---

## 📋 Debugging Checklist

```
When something breaks:

☐ Read the error message carefully
☐ Check environment variables
☐ Verify database connection
☐ Check Docker logs (if using Docker)
☐ Search Stack Overflow
☐ Check GitHub issues
☐ Ask in Discord/Slack/Reddit
☐ Use debugger (F5 in VSCode)
☐ Check git diff (what changed?)
☐ Test in isolation (simplest case)
☐ Review recent commits
☐ Check npm dependencies (@latest)
```

---

## 🆘 Emergency Contacts

```
Backend Issues:
  - NestJS Docs: https://docs.nestjs.com
  - TypeORM: https://typeorm.io
  - Stack Overflow: [nest.js] tag

Frontend Issues:
  - Next.js: https://nextjs.org/docs
  - React: https://react.dev
  - Tailwind CSS: https://tailwindcss.com/docs

DevOps Issues:
  - Docker: https://docs.docker.com
  - Docker Compose: https://docs.docker.com/compose
  - Official Docs: https://docs.docker.com

Critical Issues:
  - Check GitHub issues first
  - Create minimal reproducible example
  - Post stack trace + environment
```

---

**💡 Pro Tip:** Save this file and search it when you encounter any issue!

---

Last updated: April 8, 2025
