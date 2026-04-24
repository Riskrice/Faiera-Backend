import { Injectable } from '@nestjs/common';
import {
  Question,
  QuestionType,
  MCQOption,
  MatchingPair,
  BlankAnswer,
} from '../entities/question.entity';
import { AttemptAnswer } from '../entities/attempt-answer.entity';

export interface ScoringResult {
  isCorrect: boolean;
  partialScore: number;
  earnedPoints: number;
  correctAnswer?: unknown;
  feedback?: string;
}

@Injectable()
export class ScoringEngineService {
  scoreAnswer(question: Question, answer: AttemptAnswer): ScoringResult {
    switch (question.type) {
      case QuestionType.MCQ:
        return this.scoreMCQ(question, answer, false);
      case QuestionType.MCQ_MULTI:
        return this.scoreMCQ(question, answer, true);
      case QuestionType.TRUE_FALSE:
        return this.scoreTrueFalse(question, answer);
      case QuestionType.FILL_BLANK:
        return this.scoreFillBlank(question, answer);
      case QuestionType.MATCHING:
        return this.scoreMatching(question, answer);
      case QuestionType.ORDERING:
        return this.scoreOrdering(question, answer);
      case QuestionType.SHORT_ANSWER:
      case QuestionType.ESSAY:
        return this.markForManualGrading(question);
      default:
        return { isCorrect: false, partialScore: 0, earnedPoints: 0 };
    }
  }

  private scoreMCQ(question: Question, answer: AttemptAnswer, isMulti: boolean): ScoringResult {
    const options = question.answerData as MCQOption[];
    const correctOptionIds = options.filter(o => o.isCorrect).map(o => o.id);
    const selectedOptions = answer.selectedOptions || [];

    if (isMulti) {
      return this.scoreMultiMCQ(question, correctOptionIds, selectedOptions);
    }

    // Single MCQ
    const isCorrect =
      selectedOptions.length === 1 &&
      correctOptionIds.length === 1 &&
      selectedOptions[0] === correctOptionIds[0];

    return {
      isCorrect,
      partialScore: isCorrect ? 1 : 0,
      earnedPoints: isCorrect ? question.points : 0,
      correctAnswer: correctOptionIds[0],
    };
  }

  private scoreMultiMCQ(
    question: Question,
    correctOptionIds: string[],
    selectedOptions: string[],
  ): ScoringResult {
    const correctSelected = selectedOptions.filter(s => correctOptionIds.includes(s));
    const incorrectSelected = selectedOptions.filter(s => !correctOptionIds.includes(s));

    // All correct if all correct options selected and no incorrect ones
    const isCorrect =
      correctSelected.length === correctOptionIds.length && incorrectSelected.length === 0;

    if (!question.partialCredit) {
      return {
        isCorrect,
        partialScore: isCorrect ? 1 : 0,
        earnedPoints: isCorrect ? question.points : 0,
        correctAnswer: correctOptionIds,
      };
    }

    // Partial credit: points for each correct, minus for each incorrect
    const partialScore = Math.max(
      0,
      (correctSelected.length - incorrectSelected.length) / correctOptionIds.length,
    );

    return {
      isCorrect,
      partialScore,
      earnedPoints: Math.round(partialScore * question.points),
      correctAnswer: correctOptionIds,
    };
  }

  private scoreTrueFalse(question: Question, answer: AttemptAnswer): ScoringResult {
    const userAnswer = answer.answerData?.['booleanAnswer'] as boolean | undefined;
    const isCorrect = userAnswer === question.correctAnswer;

    return {
      isCorrect,
      partialScore: isCorrect ? 1 : 0,
      earnedPoints: isCorrect ? question.points : 0,
      correctAnswer: question.correctAnswer,
    };
  }

  private scoreFillBlank(question: Question, answer: AttemptAnswer): ScoringResult {
    const blanks = question.answerData as BlankAnswer[];
    const userAnswers = (answer.answerData?.['answers'] as string[]) || [];

    let correctCount = 0;

    blanks.forEach((blank, index) => {
      const userAnswer = userAnswers[index] || '';
      const isMatch = blank.acceptedAnswers.some(accepted => {
        if (blank.caseSensitive) {
          return accepted === userAnswer;
        }
        return accepted.toLowerCase() === userAnswer.toLowerCase();
      });
      if (isMatch) correctCount++;
    });

    const isCorrect = correctCount === blanks.length;
    const partialScore = blanks.length > 0 ? correctCount / blanks.length : 0;

    return {
      isCorrect,
      partialScore: question.partialCredit ? partialScore : isCorrect ? 1 : 0,
      earnedPoints: question.partialCredit
        ? Math.round(partialScore * question.points)
        : isCorrect
          ? question.points
          : 0,
      correctAnswer: blanks.map(b => b.acceptedAnswers[0]),
    };
  }

  private scoreMatching(question: Question, answer: AttemptAnswer): ScoringResult {
    const pairs = question.answerData as MatchingPair[];
    const userMatches = answer.matchedPairs || {};

    let correctCount = 0;

    pairs.forEach(pair => {
      if (userMatches[pair.id] === pair.id) {
        correctCount++;
      }
    });

    const isCorrect = correctCount === pairs.length;
    const partialScore = pairs.length > 0 ? correctCount / pairs.length : 0;

    return {
      isCorrect,
      partialScore: question.partialCredit ? partialScore : isCorrect ? 1 : 0,
      earnedPoints: question.partialCredit
        ? Math.round(partialScore * question.points)
        : isCorrect
          ? question.points
          : 0,
      correctAnswer: pairs.reduce((acc, p) => ({ ...acc, [p.id]: p.id }), {}),
    };
  }

  private scoreOrdering(question: Question, answer: AttemptAnswer): ScoringResult {
    const correctOrder = question.correctOrder || [];
    const userOrder = answer.orderedItems || [];

    if (correctOrder.length !== userOrder.length) {
      return { isCorrect: false, partialScore: 0, earnedPoints: 0 };
    }

    let correctPositions = 0;
    correctOrder.forEach((item, index) => {
      if (userOrder[index] === item) correctPositions++;
    });

    const isCorrect = correctPositions === correctOrder.length;
    const partialScore = correctOrder.length > 0 ? correctPositions / correctOrder.length : 0;

    return {
      isCorrect,
      partialScore: question.partialCredit ? partialScore : isCorrect ? 1 : 0,
      earnedPoints: question.partialCredit
        ? Math.round(partialScore * question.points)
        : isCorrect
          ? question.points
          : 0,
      correctAnswer: correctOrder,
    };
  }

  private markForManualGrading(_question: Question): ScoringResult {
    return {
      isCorrect: false,
      partialScore: 0,
      earnedPoints: 0,
      feedback: 'This answer requires manual grading',
    };
  }

  calculateAttemptScore(
    scoredAnswers: ScoringResult[],
    totalPossiblePoints: number,
  ): {
    earnedPoints: number;
    percentageScore: number;
    correctAnswers: number;
    incorrectAnswers: number;
  } {
    const earnedPoints = scoredAnswers.reduce((sum, a) => sum + a.earnedPoints, 0);
    const correctAnswers = scoredAnswers.filter(a => a.isCorrect).length;
    const incorrectAnswers = scoredAnswers.filter(a => !a.isCorrect && a.partialScore === 0).length;
    const percentageScore =
      totalPossiblePoints > 0 ? Math.round((earnedPoints / totalPossiblePoints) * 10000) / 100 : 0;

    return {
      earnedPoints,
      percentageScore,
      correctAnswers,
      incorrectAnswers,
    };
  }
}
