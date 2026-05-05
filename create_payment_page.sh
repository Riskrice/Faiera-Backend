set -e
mkdir -p /opt/faiera/faiera-web/src/app/payment/result

cat > /opt/faiera/faiera-web/src/app/payment/result/page.tsx << 'PAGEOF'
"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, ArrowRight, RefreshCcw, Loader2, BookOpen, GraduationCap } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { consumePendingCheckout, trackEvent, clearPendingCheckout } from "@/lib/gtm"

function PaymentResultContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Paymob appends these query params on redirect
    const success = searchParams.get('success') === 'true'
    const pending = searchParams.get('pending') === 'true'
    const transactionId = searchParams.get('transactionId')
    const provider = searchParams.get('provider') || 'paymob'
    const amountCents = searchParams.get('amount_cents')

    const [countdown, setCountdown] = useState(5)
    const [redirectPath, setRedirectPath] = useState('/explore')

    // Determine where to redirect based on payment context
    useEffect(() => {
        if (success && !pending) {
            // Track successful purchase
            const pendingCheckout = consumePendingCheckout()
            if (pendingCheckout) {
                trackEvent('purchase', {
                    transaction_id: transactionId || `faiera-${Date.now()}`,
                    ...pendingCheckout,
                })
                // Redirect to the relevant page based on what was purchased
                if (pendingCheckout.courseId) {
                    setRedirectPath(`/courses/${pendingCheckout.courseId}`)
                } else if (pendingCheckout.sessionId) {
                    setRedirectPath('/student/sessions')
                } else {
                    setRedirectPath('/student')
                }
            } else {
                setRedirectPath('/student')
            }
            toast.success("تم تأكيد عملية الدفع بنجاح ✅")
        } else {
            clearPendingCheckout()
            if (!success && !pending) {
                toast.error("فشلت عملية الدفع ❌")
            }
        }
    }, [success, pending, transactionId])

    // Auto-redirect countdown for successful payments
    useEffect(() => {
        if (!success || pending) return

        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer)
                    router.push(redirectPath)
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [success, pending, redirectPath, router])

    // Format amount
    const amount = amountCents ? (parseInt(amountCents) / 100).toFixed(2) : null

    // ── Pending State ──
    if (pending) {
        return (
            <Card className="w-full max-w-md border-amber-500/20 shadow-lg shadow-amber-500/5">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 bg-amber-100 p-4 rounded-full w-fit">
                        <Loader2 className="h-10 w-10 text-amber-600 animate-spin" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-amber-700">جاري معالجة الدفع...</CardTitle>
                    <CardDescription>
                        يتم الآن التحقق من عملية الدفع الخاصة بك
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm">
                        <p className="text-amber-800">
                            سيتم تأكيد الدفع خلال دقائق. لا تقلق، أموالك في أمان.
                        </p>
                    </div>
                    {transactionId && (
                        <div className="bg-muted/50 p-3 rounded-lg text-xs">
                            <p className="text-muted-foreground mb-1">رقم المعاملة</p>
                            <p className="font-mono font-medium text-xs">{transactionId}</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Button variant="ghost" asChild className="w-full">
                        <Link href="/student">العودة للرئيسية</Link>
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    // ── Success State ──
    if (success) {
        return (
            <Card className="w-full max-w-md border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 relative">
                        {/* Success animation rings */}
                        <div className="absolute inset-0 bg-emerald-400/20 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                        <div className="relative bg-emerald-100 p-4 rounded-full w-fit mx-auto">
                            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-emerald-700 mt-2">تم الدفع بنجاح! 🎉</CardTitle>
                    <CardDescription>
                        تمت عملية الدفع وتأكيد الحجز بنجاح
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    {amount && (
                        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                            <p className="text-sm text-emerald-600 mb-1">المبلغ المدفوع</p>
                            <p className="text-2xl font-bold text-emerald-800">{amount} ج.م</p>
                        </div>
                    )}
                    {transactionId && (
                        <div className="bg-muted/50 p-3 rounded-lg text-xs">
                            <p className="text-muted-foreground mb-1">رقم المعاملة</p>
                            <p className="font-mono font-medium text-xs">{transactionId}</p>
                        </div>
                    )}
                    <p className="text-sm text-gray-500">
                        سيتم تحويلك تلقائياً خلال <span className="font-bold text-emerald-600">{countdown}</span> ثواني...
                    </p>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700">
                        <Link href={redirectPath}>
                            <GraduationCap className="ml-2 h-4 w-4" />
                            ابدأ التعلم الآن
                        </Link>
                    </Button>
                    <Button variant="ghost" asChild className="w-full">
                        <Link href="/explore">
                            <BookOpen className="ml-2 h-4 w-4" />
                            تصفح كورسات أخرى
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    // ── Failed State ──
    return (
        <Card className="w-full max-w-md border-red-500/20 shadow-lg shadow-red-500/5">
            <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 bg-red-100 p-4 rounded-full w-fit">
                    <XCircle className="h-10 w-10 text-red-600" />
                </div>
                <CardTitle className="text-2xl font-bold text-red-700">فشل في الدفع</CardTitle>
                <CardDescription>
                    لم نتمكن من إتمام عملية الدفع الخاصة بك
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-sm">
                    <p className="text-red-800 mb-1">إذا تم خصم المبلغ، سيتم استرداده تلقائياً.</p>
                    <p className="text-red-700">يرجى التأكد من بيانات البطاقة أو المحاولة بطريقة دفع مختلفة.</p>
                </div>
                {transactionId && (
                    <div className="bg-muted/50 p-3 rounded-lg text-xs">
                        <p className="text-muted-foreground mb-1">رقم المعاملة</p>
                        <p className="font-mono font-medium text-xs">{transactionId}</p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
                <Button asChild className="w-full bg-red-600 hover:bg-red-700">
                    <Link href="/explore">
                        <RefreshCcw className="ml-2 h-4 w-4" />
                        محاولة مرة أخرى
                    </Link>
                </Button>
                <Button variant="ghost" asChild className="w-full">
                    <Link href="/student">العودة للرئيسية</Link>
                </Button>
            </CardFooter>
        </Card>
    )
}

export default function PaymentResultPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50/50 p-4">
            <Suspense fallback={
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600" />
                    <p className="text-muted-foreground">جاري التحقق من حالة الدفع...</p>
                </div>
            }>
                <PaymentResultContent />
            </Suspense>
        </div>
    )
}
PAGEOF

echo "✅ Payment result page created!"
echo "File: /opt/faiera/faiera-web/src/app/payment/result/page.tsx"
