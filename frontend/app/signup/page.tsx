import { SignupForm } from '@/features/auth';
/** 공개 회원가입은 APPLICANT 생성 API에만 연결한다. */
export default function SignupPage() {
  return (
    <main className="login-page">
      <SignupForm />
    </main>
  );
}
