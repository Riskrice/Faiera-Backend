import {
    IsString,
    IsOptional,
    IsArray,
    IsBoolean,
    IsUUID,
    IsInt,
    Min,
} from 'class-validator';

export class StartAttemptDto {
    @IsUUID()
    assessmentId!: string;
}

export class SubmitAnswerDto {
    @IsUUID()
    questionId!: string;

    // For MCQ
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    selectedOptions?: string[];

    // For text answers
    @IsOptional()
    @IsString()
    textAnswer?: string;

    // For ordering
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    orderedItems?: string[];

    // For matching
    @IsOptional()
    matchedPairs?: Record<string, string>;

    // For true/false
    @IsOptional()
    @IsBoolean()
    booleanAnswer?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    timeSpentSeconds?: number;

    @IsOptional()
    @IsBoolean()
    flaggedForReview?: boolean;
}

export class SubmitAttemptDto {
    @IsOptional()
    @IsArray()
    answers?: SubmitAnswerDto[];
}

export class GradeAnswerDto {
    @IsUUID()
    answerId!: string;

    @IsInt()
    @Min(0)
    earnedPoints!: number;

    @IsOptional()
    @IsString()
    feedback?: string;
}

export class GradeAttemptDto {
    @IsArray()
    gradedAnswers!: GradeAnswerDto[];

    @IsOptional()
    @IsString()
    overallFeedback?: string;
}

export interface AttemptResult {
    attemptId: string;
    assessmentTitle: string;
    status: string;
    startedAt: Date;
    submittedAt?: Date;
    timeSpentSeconds: number;
    totalQuestions: number;
    answeredQuestions: number;
    correctAnswers: number;
    incorrectAnswers: number;
    skippedQuestions: number;
    earnedPoints: number;
    possiblePoints: number;
    percentageScore: number;
    passed: boolean;
    feedback?: string;
    showCorrectAnswers: boolean;
    answers?: AnswerResult[];
}

export interface AnswerResult {
    questionId: string;
    questionNumber: number;
    isCorrect?: boolean;
    earnedPoints: number;
    possiblePoints: number;
    correctAnswer?: unknown;
    userAnswer?: unknown;
    explanation?: string;
    feedback?: string;
}
