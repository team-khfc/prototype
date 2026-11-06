'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { ErrorNotice, Icon } from '@/components/ui';
import { requestJson } from '@/lib/http';
import { actorSchema } from './types';

/** bcrypt 입력 한도와 서버의 비밀번호 정책을 가입 전에 안내한다. */
export function validateSignupPassword(password: string): string | null {
  if (
    password.length < 12 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password)
  )
    return '비밀번호는 12자 이상이며 영문 대문자·소문자·숫자를 모두 포함해야 합니다.';
  if (new TextEncoder().encode(password).length > 72)
    return '비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.';
  return null;
}
/** 역할·기관은 요청에 넣지 않으며 가입 성공을 자동 로그인으로 처리하지 않는다. */
export function SignupForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<unknown>();
  const signup = useMutation({
    mutationFn: (input: {
      username: string;
      password: string;
      displayName: string;
      department: string;
    }) => requestJson('/auth/signup', actorSchema, { method: 'POST', body: JSON.stringify(input) }),
  });
  if (signup.isSuccess)
    return (
      <div className="sa-login-form">
        <div className="sa-login-mark">
          <Icon name="check" width={32} height={32} />
        </div>
        <h1>회원가입을 완료했습니다</h1>
        <p>
          합성 시연 기관의 일반 사용자 계정이 만들어졌습니다. 입력한 아이디와 비밀번호로 로그인해
          주세요.
        </p>
        <Link href="/login" className="sa-button sa-primary sa-full">
          로그인으로 이동
          <Icon name="arrow" />
        </Link>
      </div>
    );
  return (
    <form
      className="sa-login-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(undefined);
        const data = new FormData(event.currentTarget);
        const problem = validateSignupPassword(password);
        if (problem || password !== confirmPassword) {
          setError(new Error(problem ?? '비밀번호 확인이 일치하지 않습니다.'));
          return;
        }
        try {
          await signup.mutateAsync({
            username: String(data.get('username')).trim(),
            password,
            displayName: String(data.get('displayName')).trim(),
            department: String(data.get('department')).trim(),
          });
          setPassword('');
          setConfirmPassword('');
        } catch (failure) {
          setError(failure);
          setPassword('');
          setConfirmPassword('');
        }
      }}
    >
      <div className="sa-login-mark">
        <Icon name="shield" width={32} height={32} />
      </div>
      <h1>일반 사용자 회원가입</h1>
      <p>
        합성 정보만 입력해 주세요. 가입 계정은 일반 사용자로 만들어지며 역할을 직접 선택하지
        않습니다.
      </p>
      <ErrorNotice error={error} />
      <div className="sa-field">
        <label htmlFor="signup-username">
          아이디 <span className="sa-required">필수</span>
        </label>
        <input
          id="signup-username"
          name="username"
          autoComplete="username"
          required
          minLength={4}
          maxLength={40}
          pattern="[A-Za-z0-9][A-Za-z0-9._\-]{3,39}"
          aria-describedby="signup-username-help"
          disabled={signup.isPending}
        />
        <small id="signup-username-help">
          영문·숫자로 시작하는 영문·숫자·점·밑줄·하이픈 4~40자
        </small>
      </div>
      <div className="sa-field">
        <label htmlFor="signup-display-name">
          표시 이름 <span className="sa-required">필수</span>
        </label>
        <input
          id="signup-display-name"
          name="displayName"
          required
          maxLength={100}
          placeholder="예: 시연 신청자"
          disabled={signup.isPending}
        />
      </div>
      <div className="sa-field">
        <label htmlFor="signup-department">
          부서 <span className="sa-meta">선택</span>
        </label>
        <input
          id="signup-department"
          name="department"
          maxLength={100}
          placeholder="예: 합성 사업팀"
          disabled={signup.isPending}
        />
      </div>
      <div className="sa-field">
        <label htmlFor="signup-password">
          비밀번호 <span className="sa-required">필수</span>
        </label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={72}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="signup-password-help"
          disabled={signup.isPending}
        />
        <small id="signup-password-help">
          12자 이상 · 영문 대문자·소문자·숫자 포함 · UTF-8 72바이트 이하
        </small>
      </div>
      <div className="sa-field">
        <label htmlFor="signup-password-confirm">
          비밀번호 확인 <span className="sa-required">필수</span>
        </label>
        <input
          id="signup-password-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          maxLength={72}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={signup.isPending}
        />
      </div>
      <button className="sa-button sa-primary sa-full" type="submit" disabled={signup.isPending}>
        {signup.isPending ? '가입 처리 중…' : '회원가입'}
      </button>
      <p className="login-hint">
        정보보안·ICT인프라·관리자 역할은 가입 후 기관 관리자가 부여합니다.
      </p>
      <Link className="sa-text-button" href="/login">
        로그인으로 돌아가기
      </Link>
    </form>
  );
}
