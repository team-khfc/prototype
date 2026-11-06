import type { Metadata } from 'next';
import { SignupForm } from '@/features/auth';
export const metadata: Metadata = { title: '회원가입' };
/** 공개 회원가입은 APPLICANT 생성 API에만 연결한다. */
export default function SignupPage() {
  return (
    <main className="sa-login-page">
      <SignupForm />
    </main>
  );
}
